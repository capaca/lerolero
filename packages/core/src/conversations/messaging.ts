// Conversas 1:1 (RF-20, RF-21): o que entra no banco quando uma mensagem chega ou sai.
// O embrulho e a abertura ficam no cofre; aqui só regras de conversa e de exibição.

import type { Rumor } from '../identity/vault.ts';
import { cleanName } from '../contacts/invite.ts';
import type { Storage } from '../storage/repositories.ts';
import type { ConversationRecord, MessageRecord } from '../storage/records.ts';

/**
 * Tag própria com o nome de quem envia, só na primeira mensagem de cada conversa:
 * o nome é privado (não há perfil público), então viaja dentro da mensagem cifrada.
 * Outros apps Nostr ignoram tags que não conhecem.
 */
export const NAME_TAG = 'nome';

export const directConversationId = (other: string) => `direta:${other}`;

const PREVIEW_LENGTH = 80;
const preview = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, PREVIEW_LENGTH);

export type StoredMessage = { message: MessageRecord; conversation: ConversationRecord; isNew: boolean };

async function upsertConversation(
	storage: Storage,
	other: string,
	message: MessageRecord,
	changes: { unread?: number; nameSent?: boolean }
): Promise<ConversationRecord> {
	const id = directConversationId(other);
	const existing = await storage.conversations.get(id);
	const isLatest = !existing || message.createdAt >= existing.lastMessageAt;
	const conversation: ConversationRecord = {
		id,
		type: 'direta',
		members: [other],
		unread: (existing?.unread ?? 0) + (changes.unread ?? 0),
		lastMessageAt: isLatest ? message.createdAt : existing.lastMessageAt,
		lastMessagePreview: isLatest ? preview(message.text) : existing.lastMessagePreview,
		nameSent: changes.nameSent || existing?.nameSent
	};
	await storage.conversations.put(conversation);
	return conversation;
}

/**
 * Guarda uma mensagem que chegou pela rede: de um contato, ou a minha própria cópia
 * (enviada de outro aparelho). Devolve undefined para o que o M1 ainda não trata
 * (grupos, reações, edições…).
 */
export async function storeIncoming(
	storage: Storage,
	me: string,
	rumor: Rumor,
	options: { openConversationId?: string } = {}
): Promise<StoredMessage | undefined> {
	if (rumor.kind !== 14) return undefined;
	const others = new Set([rumor.pubkey, ...rumor.tags.filter((t) => t[0] === 'p').map((t) => t[1])]);
	others.delete(me);
	if (others.size !== 1) return undefined; // grupo (M3) ou mensagem para mim mesmo
	const [other] = others;
	const mine = rumor.pubkey === me;

	const known = await storage.messages.get(rumor.id);
	if (known) {
		const conversation = (await storage.conversations.get(known.conversationId))!;
		return { message: known, conversation, isNew: false };
	}

	const message: MessageRecord = {
		id: rumor.id,
		conversationId: directConversationId(other),
		sender: rumor.pubkey,
		kind: 14,
		text: rumor.content,
		createdAt: rumor.created_at,
		status: mine ? 'enviada' : 'recebida'
	};
	await storage.messages.put(message);

	if (!mine) await rememberSender(storage, other, rumor);
	const unread = !mine && options.openConversationId !== message.conversationId ? 1 : 0;
	const conversation = await upsertConversation(storage, other, message, { unread });
	return { message, conversation, isNew: true };
}

/** Quem escreveu: atualiza o nome escolhido; se não é contato, guarda como pedido (a caixa de pedidos vem no M4). */
async function rememberSender(storage: Storage, sender: string, rumor: Rumor) {
	const sentName = rumor.tags.find((t) => t[0] === NAME_TAG)?.[1];
	const name = sentName ? cleanName(sentName) || undefined : undefined;
	const contact = await storage.contacts.get(sender);
	if (!contact) {
		await storage.contacts.put({ publicKey: sender, chosenName: name, state: 'pedido', dmRelays: [], addedAt: Date.now() });
	} else if (name && name !== contact.chosenName) {
		await storage.contacts.put({ ...contact, chosenName: name });
	}
}

/** Guarda a mensagem que acabei de escrever, ainda na fila ("pendente", RNF-12: aparece na hora). */
export async function storeOutgoing(storage: Storage, rumor: Rumor, recipient: string): Promise<StoredMessage> {
	const message: MessageRecord = {
		id: rumor.id,
		conversationId: directConversationId(recipient),
		sender: rumor.pubkey,
		kind: 14,
		text: rumor.content,
		createdAt: rumor.created_at,
		status: 'pendente'
	};
	await storage.messages.put(message);
	const nameSent = rumor.tags.some((t) => t[0] === NAME_TAG);
	const conversation = await upsertConversation(storage, recipient, message, { nameSent });
	return { message, conversation, isNew: true };
}

/** Um relay aceitou: "pendente" vira "enviada". */
export async function markSent(storage: Storage, messageId: string) {
	const message = await storage.messages.get(messageId);
	if (message?.status === 'pendente') await storage.messages.put({ ...message, status: 'enviada' });
}

export async function markRead(storage: Storage, conversationId: string) {
	const conversation = await storage.conversations.get(conversationId);
	if (conversation && conversation.unread > 0) await storage.conversations.put({ ...conversation, unread: 0 });
}

/** A primeira mensagem de cada conversa leva meu nome. */
export async function nameTagFor(storage: Storage, recipient: string, myName: string): Promise<string[][]> {
	const conversation = await storage.conversations.get(directConversationId(recipient));
	return conversation?.nameSent ? [] : [[NAME_TAG, cleanName(myName)]];
}
