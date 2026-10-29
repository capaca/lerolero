// Conversas 1:1 (RF-20, RF-21): o que entra no banco quando uma mensagem chega ou sai.
// O embrulho e a abertura ficam no cofre; aqui só regras de conversa e de exibição.

import type { Rumor } from '../identity/vault.ts';
import { cleanName } from '../contacts/invite.ts';
import { exclusive } from './lock.ts';
import type { Storage } from '../storage/repositories.ts';
import { validThumb } from '../media/photo.ts';
import type { ConversationRecord, MessageMedia, MessageRecord } from '../storage/records.ts';
import { summaryOf } from '../storage/summary.ts';
import { groupConversationId, groupIdOf, GROUP_TAG } from './groups.ts';
import { applyHeldEdits } from './edits.ts';
import { replyOf } from './interactions.ts';

/**
 * Tag própria com o nome de quem envia, só na primeira mensagem de cada conversa:
 * o nome é privado (não há perfil público), então viaja dentro da mensagem cifrada.
 * Outros apps Nostr ignoram tags que não conhecem. O cartão de perfil (contacts/profile.ts)
 * leva o nome também; a tag continua para quem tem uma versão sem o cartão.
 */
export const NAME_TAG = 'nome';

export const directConversationId = (other: string) => `direta:${other}`;

/**
 * Horário de uma mensagem ou aviso que eu envio, em segundos (o do Nostr). No mesmo segundo,
 * a ordem se desempata pelo id, ao acaso: duas mensagens mandadas depressa apareciam trocadas.
 * Por isso sai depois da última da conversa, mas nunca mais de um minuto à frente (o relógio
 * adiantado de outra pessoa não me arrasta).
 */
export function sendTime(conversation: Pick<ConversationRecord, 'lastMessageAt'> | undefined, now = Date.now()): number {
	const current = Math.floor(now / 1000);
	if (!conversation) return current;
	return Math.max(current, Math.min(conversation.lastMessageAt + 1, current + 60));
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
	if (media.start) tags.push(['start', String(media.start)]);
	if (media.width && media.height) tags.push(['dim', `${media.width}x${media.height}`]);
	if (media.thumb) tags.push(['thumb', media.thumb]);
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
	// de quem escreveu: valor estranho vira "toca inteiro" (nunca pula além do que o áudio tem)
	const start = Number(tag('start'));
	const [width, height] = (tag('dim') ?? '').match(/^(\d{1,5})x(\d{1,5})$/)?.slice(1).map(Number) ?? [];
	const thumb = validThumb(tag('thumb'));
	return {
		ox,
		x,
		type,
		size: Number(tag('size')) || 0,
		urls: [url, ...fallbacks].slice(0, 4),
		key,
		nonce,
		...(Number.isFinite(duration) && duration > 0 ? { duration } : {}),
		...(Number.isFinite(start) && start > 0 && start < (Number.isFinite(duration) && duration > 0 ? duration : 0) ? { start } : {}),
		...(width && height ? { width, height } : {}),
		...(thumb ? { thumb } : {})
	};
}

/**
 * O que mandar para encaminhar uma mensagem a outra conversa (RF-70): o texto, ou a mesma referência do arquivo
 * (endereço, chave e hashes), sem baixar nem subir de novo. undefined para o que não se encaminha: apagada, aviso
 * de grupo e arquivo que ainda não terminou de subir.
 */
export function forwardOf(message: MessageRecord): { content: string; tags: string[][]; kind: 14 | 15 } | undefined {
	if (message.deleted || message.notice || message.upload) return undefined;
	if (message.media) return message.media.urls.length ? { content: message.media.urls[0], tags: mediaTags(message.media), kind: 15 } : undefined;
	return message.text ? { content: message.text, tags: [], kind: 14 } : undefined;
}

export type StoredMessage = { message: MessageRecord; conversation: ConversationRecord; isNew: boolean };

async function upsertConversation(
	storage: Storage,
	message: MessageRecord,
	changes: { unread?: number; nameSent?: boolean; heardFrom?: boolean },
	fresh: Pick<ConversationRecord, 'type' | 'members'>
): Promise<ConversationRecord> {
	const id = message.conversationId;
	const existing = await storage.conversations.get(id);
	const isLatest = !existing || message.createdAt >= existing.lastMessageAt;
	const conversation: ConversationRecord = {
		...fresh,
		...existing,
		id,
		unread: (existing?.unread ?? 0) + (changes.unread ?? 0),
		lastMessageAt: isLatest ? message.createdAt : existing.lastMessageAt,
		...(isLatest ? summaryOf(message) : {}),
		nameSent: changes.nameSent || existing?.nameSent,
		...(changes.heardFrom || existing?.heardFrom ? { heardFrom: true } : {})
	};
	await storage.conversations.put(conversation);
	return conversation;
}

/**
 * Guarda uma mensagem que chegou pela rede: de um contato, ou a minha própria cópia
 * (enviada de outro aparelho). Devolve undefined para o que o M1 ainda não trata
 * (grupos, reações, edições…).
 */
async function storeIncomingNow(
	storage: Storage,
	me: string,
	rumor: Rumor,
	options: IncomingOptions = {}
): Promise<StoredMessage | undefined> {
	if (rumor.kind === 5) return applyDeletion(storage, rumor);
	if (rumor.kind !== 14 && rumor.kind !== 15) return undefined;
	const media = rumor.kind === 15 ? mediaFromRumor(rumor) : undefined;
	if (rumor.kind === 15 && !media) return undefined; // arquivo que não sabemos abrir
	// bloqueado (RF-13): descartado sem guardar, no 1:1 e nos grupos; o pedido de apagar (kind 5) segue valendo
	if (rumor.pubkey !== me && (await storage.contacts.get(rumor.pubkey))?.state === 'bloqueado') return undefined;
	if (rumor.tags.some((t) => t[0] === GROUP_TAG)) return storeGroupMessage(storage, me, rumor, media, options);
	const others = new Set([rumor.pubkey, ...rumor.tags.filter((t) => t[0] === 'p').map((t) => t[1])]);
	others.delete(me);
	if (others.size !== 1) return undefined; // grupo de outro app (sem tag g) ou mensagem para mim mesmo
	const [other] = others;
	const mine = rumor.pubkey === me;

	const known = await storage.messages.get(rumor.id);
	const knownConversation = known && (await storage.conversations.get(known.conversationId));
	if (known && knownConversation) return { message: known, conversation: knownConversation, isNew: false };

	// Se o app morreu entre guardar a mensagem e criar a conversa, o embrulho volta e a mensagem já existe, sem
	// conversa: refaz o resto em vez de a mensagem ficar invisível para sempre (a gravação não é atômica).
	let message = known ?? incomingRecord(rumor, directConversationId(other), media, mine, options);
	if (!known) {
		await storage.messages.put(message);
		message = await applyHeldEdits(storage, message);
	}

	if (!mine) await rememberSender(storage, other, rumor, options.proven ?? true);
	const unread = !mine && message.ack !== 'lida' && options.openConversationId !== message.conversationId ? 1 : 0;
	const conversation = await upsertConversation(storage, message, { unread, heardFrom: !mine }, { type: 'direta', members: [other] });
	return { message, conversation, isNew: true };
}

export type IncomingOptions = {
	openConversationId?: string;
	/**
	 * Restaurei a conta neste horário (segundos): o que chegou antes já foi lido no aparelho antigo, então entra como
	 * lido e sem confirmação de novo (o "lida" não é sincronizado entre aparelhos; decidido em 2026-10-29).
	 */
	readBefore?: number;
	/** o embrulho tinha a prova de trabalho (RF-90); sem ela, o pedido de quem não é contato vira "Possível spam" */
	proven?: boolean;
};

function incomingRecord(
	rumor: Rumor,
	conversationId: string,
	media: MessageMedia | undefined,
	mine: boolean,
	options: IncomingOptions
): MessageRecord {
	const alreadyRead = !mine && options.readBefore !== undefined && rumor.created_at < options.readBefore;
	return {
		id: rumor.id,
		conversationId,
		sender: rumor.pubkey,
		kind: rumor.kind,
		text: media ? '' : rumor.content,
		createdAt: rumor.created_at,
		status: mine ? 'enviada' : 'recebida',
		...(media ? { media } : {}),
		...(replyOf(rumor) ? { replyTo: replyOf(rumor) } : {}),
		...(alreadyRead ? { ack: 'lida' as const } : {})
	};
}

/**
 * Mensagem de grupo: só vale de quem é ou já foi membro (mensagens antigas de quem saiu
 * continuam). Se o aviso que me pôs no grupo ainda não chegou, a mensagem fica guardada
 * sem conversa e entra quando ele chegar (groups.ts, adoptHeldMessages).
 */
async function storeGroupMessage(
	storage: Storage,
	me: string,
	rumor: Rumor,
	media: MessageMedia | undefined,
	options: IncomingOptions
): Promise<StoredMessage | undefined> {
	const groupId = groupIdOf(rumor);
	if (!groupId) return undefined;
	const id = groupConversationId(groupId);
	const known = await storage.messages.get(rumor.id);
	const existing = await storage.conversations.get(id);
	if (known) return existing && { message: known, conversation: existing, isNew: false };
	if (existing?.group?.request?.state === 'recusado') return undefined; // grupo bloqueado (RF-13): descartado

	const mine = rumor.pubkey === me;
	if (existing && !mine && !existing.group?.everMembers.includes(rumor.pubkey)) return undefined;
	let message = incomingRecord(rumor, id, media, mine, options);
	await storage.messages.put(message);
	message = await applyHeldEdits(storage, message);
	if (!existing) return undefined;

	const unread = !mine && message.ack !== 'lida' && options.openConversationId !== id ? 1 : 0;
	let conversation = await upsertConversation(storage, message, { unread }, existing);
	// a primeira mensagem de cada um no grupo também traz o nome, caso a apresentação se perca
	const sentName = mine ? undefined : cleanName(rumor.tags.find((t) => t[0] === NAME_TAG)?.[1] ?? '');
	if (sentName && conversation.group && conversation.group.names[rumor.pubkey] !== sentName) {
		conversation = { ...conversation, group: { ...conversation.group, names: { ...conversation.group.names, [rumor.pubkey]: sentName } } };
		await storage.conversations.put(conversation);
	}
	return { message, conversation, isNew: true };
}

/** Quem escreveu: atualiza o nome escolhido; se não é contato, guarda como pedido (a caixa de pedidos vem no M4). */
async function rememberSender(storage: Storage, sender: string, rumor: Rumor, proven: boolean) {
	const sentName = rumor.tags.find((t) => t[0] === NAME_TAG)?.[1];
	const name = sentName ? cleanName(sentName) || undefined : undefined;
	const contact = await storage.contacts.get(sender);
	if (!contact) {
		const unproven = proven ? {} : { unproven: true };
		await storage.contacts.put({ publicKey: sender, chosenName: name, state: 'pedido', dmRelays: [], addedAt: Date.now(), ...unproven });
		return;
	}
	// uma mensagem com a prova tira o pedido de "Possível spam" (ex.: a pessoa atualizou o app)
	const { unproven: _, ...proved } = contact;
	const next = contact.unproven && proven ? proved : contact;
	if (next !== contact || (name && name !== contact.chosenName)) await storage.contacts.put({ ...next, chosenName: name ?? contact.chosenName });
}

/**
 * Guarda a mensagem que acabei de escrever, ainda na fila ("pendente", RNF-12: aparece na hora).
 * `recipient` é o contato, numa conversa 1:1; nos grupos, a conversa vem da tag `g`.
 */
async function storeOutgoingNow(storage: Storage, rumor: Rumor, recipient?: string): Promise<StoredMessage> {
	const media = rumor.kind === 15 ? mediaFromRumor(rumor) : undefined;
	const groupId = groupIdOf(rumor);
	const group = groupId ? await storage.conversations.get(groupConversationId(groupId)) : undefined;
	if (!group && !recipient) throw new Error('conversa desconhecida');
	const message: MessageRecord = {
		id: rumor.id,
		conversationId: group ? group.id : directConversationId(recipient!),
		sender: rumor.pubkey,
		kind: rumor.kind,
		text: media ? '' : rumor.content,
		createdAt: rumor.created_at,
		status: 'pendente',
		...(media ? { media } : {}),
		...(replyOf(rumor) ? { replyTo: replyOf(rumor) } : {})
	};
	await storage.messages.put(message);
	const nameSent = rumor.tags.some((t) => t[0] === NAME_TAG);
	const conversation = await upsertConversation(storage, message, { nameSent }, group ?? { type: 'direta', members: [recipient!] });
	return { message, conversation, isNew: true };
}

/**
 * Guarda o balão provisório de uma mídia que ainda vai subir (media/pending-upload.ts): aparece na conversa na
 * hora, como a mensagem "pendente" (RNF-12), e é trocado pela mensagem de verdade quando o envio termina.
 */
async function storePendingMessageNow(storage: Storage, message: MessageRecord): Promise<void> {
	await storage.messages.put(message);
	const direct = message.conversationId.startsWith('direta:');
	const fresh = direct ? { type: 'direta' as const, members: [message.conversationId.slice('direta:'.length)] } : undefined;
	const existing = await storage.conversations.get(message.conversationId);
	if (!existing && !fresh) throw new Error('conversa desconhecida');
	await upsertConversation(storage, message, {}, existing ?? fresh!);
}

/** Um relay aceitou: "pendente" vira "enviada". */
export async function markSent(storage: Storage, messageId: string) {
	const message = await storage.messages.get(messageId);
	if (message?.status === 'pendente') await storage.messages.put({ ...message, status: 'enviada' });
}

async function markReadNow(storage: Storage, conversationId: string) {
	const conversation = await storage.conversations.get(conversationId);
	if (conversation && conversation.unread > 0) await storage.conversations.put({ ...conversation, unread: 0 });
}

/** Favoritar ou desfavoritar (RF-28): só neste aparelho. Não favorita o que foi apagado nem aviso de grupo. */
async function setStarredNow(storage: Storage, messageIds: string[], starred: boolean) {
	for (const id of messageIds) {
		const message = await storage.messages.get(id);
		if (!message || message.deleted || message.notice || !!message.starred === starred) continue;
		await storage.messages.put({ ...message, starred: starred || undefined });
	}
}

/** A primeira mensagem de cada conversa leva meu nome. `recipient`: o contato, ou o id de uma conversa de grupo. */
export async function nameTagFor(storage: Storage, recipient: string, myName: string): Promise<string[][]> {
	const id = recipient.startsWith('grupo:') ? recipient : directConversationId(recipient);
	const conversation = await storage.conversations.get(id);
	return conversation?.nameSent ? [] : [[NAME_TAG, cleanName(myName)]];
}

// ---------- apagar (RF-25) ----------

/**
 * O que eu mando para `recipient` precisa de prova de trabalho (RF-90)? Precisa enquanto a pessoa nunca me escreveu
 * no 1:1: sem isso, eu posso ser só um "pedido de mensagem" para ela. Conversa de antes da marca `heardFrom` é
 * conferida nas mensagens uma vez.
 */
export async function needsProof(storage: Storage, recipient: string): Promise<boolean> {
	const conversation = await storage.conversations.get(directConversationId(recipient));
	if (!conversation) return true;
	if (conversation.heardFrom) return false;
	const recent = await storage.messages.listByConversation(conversation.id, 200);
	if (!recent.some((m) => m.sender === recipient)) return true;
	// relê dentro da trava: gravar a cópia de antes apagaria o que mudou nesse meio-tempo (não lidas, prévia)
	await exclusive(storage, async () => {
		const current = await storage.conversations.get(conversation.id);
		if (current) await storage.conversations.put({ ...current, heardFrom: true });
	});
	return false;
}

/** Tags do pedido de apagar (NIP-09, kind 5) para uma mensagem minha. */
export const deletionTags = (message: MessageRecord): string[][] => [
	['e', message.id],
	['k', String(message.kind)]
];

/** Recalcula a prévia da conversa depois que uma mensagem sumiu ou foi apagada. */
export async function refreshConversation(storage: Storage, conversationId: string) {
	const conversation = await storage.conversations.get(conversationId);
	if (!conversation) return;
	const [latest] = await storage.messages.listByConversation(conversationId, 1);
	await storage.conversations.put({
		...conversation,
		lastMessageAt: latest?.createdAt ?? conversation.lastMessageAt,
		...summaryOf(latest)
	});
}

/** Apaga o arquivo do aparelho se nenhuma outra mensagem usa o mesmo (o hash `ox`). */
async function dropMediaIfUnused(storage: Storage, ox: string | undefined) {
	if (ox && (await storage.messages.countUsingMedia(ox)) === 0) await storage.media.delete(ox);
}

/** Troca a mensagem pelo aviso "apagada": some o texto e o arquivo, fica o lugar na conversa. */
export async function markDeleted(storage: Storage, message: MessageRecord): Promise<MessageRecord> {
	const deleted: MessageRecord = { ...message, text: '', media: undefined, replyTo: undefined, starred: undefined, deleted: true };
	await storage.messages.put(deleted);
	await storage.reactions.deleteByMessage(message.id);
	await dropMediaIfUnused(storage, message.media?.ox);
	// a prévia só muda se a apagada era a mais recente (sem depender da ordem de empates no mesmo segundo)
	const conversation = await storage.conversations.get(message.conversationId);
	if (conversation && message.createdAt >= conversation.lastMessageAt) {
		await storage.conversations.put({ ...conversation, ...summaryOf(deleted) });
	}
	return deleted;
}

/** Apagar para mim: some do aparelho, sem aviso a ninguém. */
async function deleteForMeNow(storage: Storage, messageId: string) {
	const message = await storage.messages.get(messageId);
	if (!message) return;
	await storage.messages.delete(messageId);
	await storage.reactions.deleteByMessage(messageId);
	await dropMediaIfUnused(storage, message.media?.ox);
	await refreshConversation(storage, message.conversationId);
}

/** Limite de `listByConversation` que cobre a conversa inteira (o IndexedDB aceita até 2^32 - 1). */
const EVERY_MESSAGE = 1_000_000_000;

/**
 * Excluir conversa (só para mim): somem a conversa, as mensagens e os arquivos que mais ninguém usa, sem aviso a
 * ninguém. O contato e, nos grupos, o estado do grupo ficam. Quem ainda sobe um arquivo cancela o envio antes
 * (`discard`, que tem a sua própria vez); o que já está na fila de envio de texto sai normalmente.
 */
export async function deleteConversation(storage: Storage, conversationId: string, discard: (messageId: string) => Promise<void>) {
	await clearConversation(storage, conversationId, discard, true);
}

/** Apaga as mensagens e, com `drop`, a conversa; sem ele a conversa fica (grupo recusado: guarda o estado, T7). */
export async function clearConversation(storage: Storage, conversationId: string, discard: (messageId: string) => Promise<void>, drop = false) {
	const all = await storage.messages.listByConversation(conversationId, EVERY_MESSAGE);
	for (const message of all) if (message.upload) await discard(message.id);
	await exclusive(storage, async () => {
		for (const message of await storage.messages.listByConversation(conversationId, EVERY_MESSAGE)) {
			await storage.messages.delete(message.id);
			await storage.reactions.deleteByMessage(message.id);
			await dropMediaIfUnused(storage, message.media?.ox);
		}
		if (drop) await storage.conversations.delete(conversationId);
		else {
			const conversation = await storage.conversations.get(conversationId);
			if (conversation) await storage.conversations.put({ ...conversation, unread: 0, lastMessageKind: undefined, lastMessagePreview: undefined, lastNotice: undefined });
		}
	});
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

// Quem grava a conversa espera a vez (lock.ts). `markDeleted` fica de fora: `storeIncoming` a chama por dentro.
export const storeIncoming = (...args: Parameters<typeof storeIncomingNow>) => exclusive(args[0], () => storeIncomingNow(...args));
export const storeOutgoing = (...args: Parameters<typeof storeOutgoingNow>) => exclusive(args[0], () => storeOutgoingNow(...args));
export const storePendingMessage = (...args: Parameters<typeof storePendingMessageNow>) =>
	exclusive(args[0], () => storePendingMessageNow(...args));
export const setStarred = (...args: Parameters<typeof setStarredNow>) => exclusive(args[0], () => setStarredNow(...args));
export const markRead = (...args: Parameters<typeof markReadNow>) => exclusive(args[0], () => markReadNow(...args));
export const deleteForMe = (...args: Parameters<typeof deleteForMeNow>) => exclusive(args[0], () => deleteForMeNow(...args));
