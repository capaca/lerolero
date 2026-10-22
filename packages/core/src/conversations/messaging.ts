// Conversas 1:1 (RF-20, RF-21): o que entra no banco quando uma mensagem chega ou sai.
// O embrulho e a abertura ficam no cofre; aqui só regras de conversa e de exibição.

import type { Rumor } from '../identity/vault.ts';
import { cleanName } from '../contacts/invite.ts';
import type { Storage } from '../storage/repositories.ts';
import type { ConversationRecord, MessageMedia, MessageRecord } from '../storage/records.ts';

/**
 * Tag própria com o nome de quem envia, só na primeira mensagem de cada conversa:
 * o nome é privado (não há perfil público), então viaja dentro da mensagem cifrada.
 * Outros apps Nostr ignoram tags que não conhecem.
 */
export const NAME_TAG = 'nome';

export const directConversationId = (other: string) => `direta:${other}`;

const PREVIEW_LENGTH = 80;

function kindOf(message: Pick<MessageRecord, 'media'>): 'texto' | 'audio' | 'arquivo' {
	if (!message.media) return 'texto';
	return message.media.type.startsWith('audio/') ? 'audio' : 'arquivo';
}

/** Prévia em texto; o ícone fica por conta da interface, pelo `lastMessageKind`. */
function preview(message: Pick<MessageRecord, 'text' | 'media' | 'deleted'>): string {
	if (message.deleted) return 'Mensagem apagada';
	const kind = kindOf(message);
	if (kind === 'audio') return 'Áudio';
	if (kind === 'arquivo') return 'Arquivo';
	return message.text.replace(/\s+/g, ' ').trim().slice(0, PREVIEW_LENGTH);
}

/**
 * Tags do kind 15 (NIP-17) a partir de um arquivo já enviado ao Blossom. A primeira URL
 * vai no conteúdo; as outras como `fallback`, para quem recebe tentar se a primeira falhar.
 */
export function mediaTags(media: MessageMedia): string[][] {
	const tags = [
		['file-type', media.type],
		['encryption-algorithm', 'aes-gcm'],
		['decryption-key', media.key],
		['decryption-nonce', media.nonce],
		['x', media.x],
		['ox', media.ox],
		['size', String(media.size)],
		...media.urls.slice(1).map((u) => ['fallback', u])
	];
	if (media.duration !== undefined) tags.push(['duration', String(Math.round(media.duration))]);
	return tags;
}

/** Lê o arquivo de um rumor kind 15; undefined se faltar algo ou não for AES-GCM. */
export function mediaFromRumor(rumor: Rumor): MessageMedia | undefined {
	const tag = (name: string) => rumor.tags.find((t) => t[0] === name)?.[1];
	const hex = (v: string | undefined, len: number) => (v && new RegExp(`^[0-9a-f]{${len}}$`).test(v) ? v : undefined);
	const url = /^https:\/\/\S+$/.test(rumor.content) ? rumor.content : undefined;
	const fallbacks = rumor.tags.filter((t) => t[0] === 'fallback' && /^https:\/\/\S+$/.test(t[1] ?? '')).map((t) => t[1]);
	const key = hex(tag('decryption-key'), 64);
	const nonce = hex(tag('decryption-nonce'), 24);
	const x = hex(tag('x'), 64);
	const ox = hex(tag('ox'), 64);
	const type = tag('file-type');
	if (!url || !key || !nonce || !x || !ox || !type || tag('encryption-algorithm') !== 'aes-gcm') return undefined;
	const duration = Number(tag('duration'));
	return {
		ox,
		x,
		type,
		size: Number(tag('size')) || 0,
		urls: [url, ...fallbacks].slice(0, 4),
		key,
		nonce,
		...(Number.isFinite(duration) && duration > 0 ? { duration } : {})
	};
}

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
		lastMessagePreview: isLatest ? preview(message) : existing.lastMessagePreview,
		lastMessageKind: isLatest ? kindOf(message) : existing.lastMessageKind,
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
	if (rumor.kind === 5) return applyDeletion(storage, rumor);
	if (rumor.kind !== 14 && rumor.kind !== 15) return undefined;
	const media = rumor.kind === 15 ? mediaFromRumor(rumor) : undefined;
	if (rumor.kind === 15 && !media) return undefined; // arquivo que não sabemos abrir
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
		kind: rumor.kind,
		text: media ? '' : rumor.content,
		createdAt: rumor.created_at,
		status: mine ? 'enviada' : 'recebida',
		...(media ? { media } : {})
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
	const media = rumor.kind === 15 ? mediaFromRumor(rumor) : undefined;
	const message: MessageRecord = {
		id: rumor.id,
		conversationId: directConversationId(recipient),
		sender: rumor.pubkey,
		kind: rumor.kind,
		text: media ? '' : rumor.content,
		createdAt: rumor.created_at,
		status: 'pendente',
		...(media ? { media } : {})
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

// ---------- apagar (RF-25) ----------

/** Tags do pedido de apagar (NIP-09, kind 5) para uma mensagem minha. */
export const deletionTags = (message: MessageRecord): string[][] => [
	['e', message.id],
	['k', String(message.kind)]
];

/** Recalcula a prévia da conversa depois que uma mensagem sumiu ou foi apagada. */
async function refreshConversation(storage: Storage, conversationId: string) {
	const conversation = await storage.conversations.get(conversationId);
	if (!conversation) return;
	const [latest] = await storage.messages.listByConversation(conversationId, 1);
	await storage.conversations.put({
		...conversation,
		lastMessageAt: latest?.createdAt ?? conversation.lastMessageAt,
		lastMessagePreview: latest ? preview(latest) : undefined,
		lastMessageKind: latest && !latest.deleted ? kindOf(latest) : 'texto'
	});
}

/** Apaga o arquivo do aparelho se nenhuma outra mensagem usa o mesmo (o hash `ox`). */
async function dropMediaIfUnused(storage: Storage, ox: string | undefined) {
	if (ox && (await storage.messages.countUsingMedia(ox)) === 0) await storage.media.delete(ox);
}

/** Troca a mensagem pelo aviso "apagada": some o texto e o arquivo, fica o lugar na conversa. */
export async function markDeleted(storage: Storage, message: MessageRecord): Promise<MessageRecord> {
	const deleted: MessageRecord = { ...message, text: '', media: undefined, deleted: true };
	await storage.messages.put(deleted);
	await dropMediaIfUnused(storage, message.media?.ox);
	// a prévia só muda se a apagada era a mais recente (sem depender da ordem de empates no mesmo segundo)
	const conversation = await storage.conversations.get(message.conversationId);
	if (conversation && message.createdAt >= conversation.lastMessageAt) {
		await storage.conversations.put({ ...conversation, lastMessagePreview: preview(deleted), lastMessageKind: 'texto' });
	}
	return deleted;
}

/** Apagar para mim: some do aparelho, sem aviso a ninguém. */
export async function deleteForMe(storage: Storage, messageId: string) {
	const message = await storage.messages.get(messageId);
	if (!message) return;
	await storage.messages.delete(messageId);
	await dropMediaIfUnused(storage, message.media?.ox);
	await refreshConversation(storage, message.conversationId);
}

/**
 * Pedido de apagar recebido: só vale se veio de quem escreveu a mensagem. Um contato
 * não consegue apagar mensagens de outra pessoa, nem as minhas.
 */
async function applyDeletion(storage: Storage, rumor: Rumor): Promise<StoredMessage | undefined> {
	let result: StoredMessage | undefined;
	for (const id of rumor.tags.filter((t) => t[0] === 'e').map((t) => t[1])) {
		const message = await storage.messages.get(id);
		if (!message || message.deleted || message.sender !== rumor.pubkey) continue;
		const deleted = await markDeleted(storage, message);
		const conversation = (await storage.conversations.get(message.conversationId))!;
		result = { message: deleted, conversation, isNew: true };
	}
	return result;
}
