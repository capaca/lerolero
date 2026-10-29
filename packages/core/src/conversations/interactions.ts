// Reações (RF-23, kind 7) e confirmações de entrega e leitura (RF-50, 51, kind 4441): o que uma pessoa faz com uma
// mensagem sem ser uma mensagem nova. Nada daqui entra na lista de conversas nem conta como não lida.

import type { Rumor } from '../identity/vault.ts';
import type { Storage } from '../storage/repositories.ts';
import type { ConversationRecord, MessageRecord, Receipt } from '../storage/records.ts';
import { groupConversationId, groupIdOf } from './groups.ts';
import { exclusive } from './lock.ts';
import { directConversationId } from './messaging.ts';

const isId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);

/** Emojis do menu da mensagem. Quem recebe aceita qualquer reação curta (NIP-25), de outros apps também. */
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

/**
 * O seletor completo ("+" no menu): rostos, gestos, corações e coisas do dia a dia. Quem recebe aceita qualquer
 * reação curta, então a lista é só uma sugestão e pode crescer sem mudar o protocolo.
 */
export const REACTION_PICKER = [
	'😀', '😂', '🤣', '😊', '😍', '😘', '😎', '🤔',
	'😮', '😢', '😭', '😡', '🥳', '😴', '🤯', '🙄',
	'👍', '👎', '👏', '🙌', '🙏', '💪', '🤝', '👀',
	'❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔',
	'🔥', '🎉', '✨', '💯', '✅', '❌', '🎂', '🍕',
	'☕', '🍺', '⚽', '🚀', '🌹', '🌞', '🌧️', '🐶'
] as const;

/** Tags de um pedido de reação a uma mensagem (NIP-25). */
export const reactionTags = (message: Pick<MessageRecord, 'id' | 'kind'>): string[][] => [
	['e', message.id],
	['k', String(message.kind)]
];

/** Tags de uma resposta: a mensagem citada, com o marcador `reply` do NIP-10 (docs/06 §3.2). */
export const replyTags = (messageId: string): string[][] => [['e', messageId, '', 'reply']];

/** Mensagem que o rumor responde, se citar uma. */
export function replyOf(rumor: Pick<Rumor, 'tags'>): string | undefined {
	return rumor.tags.find((t) => t[0] === 'e' && isId(t[1]))?.[1];
}

/** A conversa a que um rumor de reação ou confirmação pertence, do ponto de vista de quem o escreveu. */
export async function conversationOf(storage: Storage, me: string, rumor: Rumor): Promise<ConversationRecord | undefined> {
	const groupId = groupIdOf(rumor);
	if (groupId) {
		const conversation = await storage.conversations.get(groupConversationId(groupId));
		const sender = rumor.pubkey;
		return conversation?.group && (sender === me || conversation.group.everMembers.includes(sender)) ? conversation : undefined;
	}
	const others = new Set([rumor.pubkey, ...rumor.tags.filter((t) => t[0] === 'p').map((t) => t[1])]);
	others.delete(me);
	if (others.size !== 1) return undefined;
	return storage.conversations.get(directConversationId([...others][0]));
}

/**
 * Guarda uma reação (minha, vinda de outro aparelho, ou de quem está na conversa). Cada pessoa tem uma por mensagem:
 * a mais recente substitui a anterior. Devolve se algo mudou.
 */
async function storeReactionNow(storage: Storage, me: string, rumor: Rumor): Promise<boolean> {
	const target = rumor.tags.find((t) => t[0] === 'e')?.[1];
	const emoji = rumor.content.trim();
	if (!isId(target) || !emoji || [...emoji].length > 16) return false;
	if (rumor.pubkey !== me && (await storage.contacts.get(rumor.pubkey))?.state === 'bloqueado') return false;
	const conversation = await conversationOf(storage, me, rumor);
	if (!conversation) return false;
	if (await storage.reactions.get(rumor.id)) return false;
	// a reação tem de ser à mensagem desta conversa: a de outra não pode ser escrita por aqui
	const message = await storage.messages.get(target);
	if (message && message.conversationId !== conversation.id) return false;
	const previous = await storage.reactions.listBySender(target, rumor.pubkey);
	if (previous.some((r) => r.createdAt > rumor.created_at)) return false;
	for (const old of previous) await storage.reactions.delete(old.id);
	await storage.reactions.put({
		id: rumor.id,
		messageId: target,
		conversationId: conversation.id,
		sender: rumor.pubkey,
		emoji,
		createdAt: rumor.created_at
	});
	return true;
}

/** Pedido de apagar (kind 5) que cita uma reação: só vale de quem a escreveu. Devolve se desfez alguma. */
async function removeReactionsNow(storage: Storage, rumor: Rumor): Promise<boolean> {
	let changed = false;
	for (const id of rumor.tags.filter((t) => t[0] === 'e').map((t) => t[1])) {
		const reaction = await storage.reactions.get(id);
		if (reaction && reaction.sender === rumor.pubkey) {
			await storage.reactions.delete(id);
			changed = true;
		}
	}
	return changed;
}

const RANK: Record<Receipt, number> = { entregue: 1, lida: 2 };

/**
 * Confirmação recebida: marca as minhas mensagens citadas como entregues ou lidas por quem a enviou. Só vale de quem
 * está na conversa e só para mensagem minha; "lida" só conta com a confirmação de leitura ligada (RF-51: quem desliga
 * também deixa de ver as dos outros). Devolve se algo mudou.
 */
async function storeReceiptNow(storage: Storage, me: string, rumor: Rumor, options: { readReceipts: boolean }): Promise<boolean> {
	if (rumor.pubkey === me) return false;
	const status = rumor.tags.find((t) => t[0] === 'status')?.[1];
	if (status !== 'entregue' && status !== 'lida') return false;
	const receipt: Receipt = status === 'lida' && !options.readReceipts ? 'entregue' : status;
	const ids = rumor.tags.filter((t) => t[0] === 'e' && isId(t[1])).map((t) => t[1]);
	let changed = false;
	for (const id of ids.slice(0, 200)) {
		const message = await storage.messages.get(id);
		if (!message || message.sender !== me || message.deleted || message.notice) continue;
		const conversation = await storage.conversations.get(message.conversationId);
		if (!conversation || !conversation.members.includes(rumor.pubkey)) continue;
		const current = message.receipts?.[rumor.pubkey];
		if (current && RANK[current] >= RANK[receipt]) continue;
		await storage.messages.put({ ...message, receipts: { ...message.receipts, [rumor.pubkey]: receipt } });
		changed = true;
	}
	return changed;
}

export type Delivery = 'pendente' | 'enviada' | 'entregue' | 'lida';

/**
 * O estado de uma mensagem minha na tela (RF-50). Num grupo só passa a "entregue" ou "lida" quando todos os membros
 * de agora confirmaram: o estado mostrado é o do mais atrasado.
 */
export function deliveryOf(message: Pick<MessageRecord, 'status' | 'receipts'>, recipients: string[]): Delivery {
	if (message.status === 'pendente') return 'pendente';
	if (!recipients.length || !message.receipts) return 'enviada';
	const levels = recipients.map((r) => message.receipts![r]);
	if (levels.every((l) => l === 'lida')) return 'lida';
	if (levels.every((l) => l !== undefined)) return 'entregue';
	return 'enviada';
}

/**
 * Das mensagens `ids`, as que devo confirmar a `status` a quem as escreveu, agrupadas por remetente. Só confirmo a
 * quem já é contato (ou ao grupo que aceitei): um pedido de mensagem não ganha sinal de que estou aqui (RF-12).
 */
export async function receiptsDue(storage: Storage, me: string, ids: string[], status: Receipt): Promise<Map<string, string[]>> {
	const bySender = new Map<string, string[]>();
	for (const id of ids) {
		const message = await storage.messages.get(id);
		if (!message || message.sender === me || message.notice || message.upload) continue;
		if (message.ack && RANK[message.ack] >= RANK[status]) continue;
		const conversation = await storage.conversations.get(message.conversationId);
		if (!conversation) continue;
		const allowed = conversation.group
			? !conversation.group.request
			: (await storage.contacts.get(message.sender))?.state === 'aceito';
		if (!allowed) continue;
		bySender.set(message.sender, [...(bySender.get(message.sender) ?? []), id]);
	}
	return bySender;
}

/** Guarda o que já confirmei, para não repetir a confirmação a cada vez que a conversa abre. */
async function markAcknowledgedNow(storage: Storage, ids: string[], status: Receipt) {
	for (const id of ids) {
		const message = await storage.messages.get(id);
		if (message && !(message.ack && RANK[message.ack] >= RANK[status])) await storage.messages.put({ ...message, ack: status });
	}
}

// Quem grava espera a vez (lock.ts), como em messaging.ts: uma confirmação e uma mensagem chegando juntas não se pisam.
export const storeReaction = (...args: Parameters<typeof storeReactionNow>) => exclusive(args[0], () => storeReactionNow(...args));
export const removeReactions = (...args: Parameters<typeof removeReactionsNow>) => exclusive(args[0], () => removeReactionsNow(...args));
export const storeReceipt = (...args: Parameters<typeof storeReceiptNow>) => exclusive(args[0], () => storeReceiptNow(...args));
export const markAcknowledged = (...args: Parameters<typeof markAcknowledgedNow>) => exclusive(args[0], () => markAcknowledgedNow(...args));
