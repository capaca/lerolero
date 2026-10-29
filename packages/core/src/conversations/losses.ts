// Detecção de perdas (RF-53, docs/06 §3.5): cada um numera as próprias mensagens em cada conversa (tag `seq`), quem
// recebe acha os buracos e pede o reenvio, e quem enviou reenvia sozinho o mesmo rumor. Do lado de quem enviou, a
// mensagem sem confirmação em 7 dias vira "possivelmente perdida", com o botão de reenviar.

import { MAX_RESEND_SEQS, type Rumor } from '../identity/vault.ts';
import type { Storage } from '../storage/repositories.ts';
import type { ConversationRecord, MessageRecord, SeqTrack } from '../storage/records.ts';
import { groupIdOf } from './groups.ts';
import { conversationOf } from './interactions.ts';
import { exclusive } from './lock.ts';

export const SEQ_TAG = 'seq';

const DAY = 24 * 60 * 60;
/** Sem confirmação nesse prazo, a mensagem pode ter se perdido: é também quanto os relays guardam (Q-R1). */
export const LOSS_DEADLINE_S = 7 * DAY;
/**
 * Espera antes de pedir o que falta (Q-P3): os relays entregam fora de ordem, e o embrulho que falta costuma chegar
 * em segundos. Pedir cedo demais só custa uma repetida, que quem recebe descarta pelo id.
 */
export const GAP_WAIT_S = 30;
/** O próprio pedido pode se perder: pede de novo um dia depois, até 3 vezes, e então desiste. */
export const ASK_AGAIN_S = DAY;
export const MAX_ASKS = 3;

/** O número de uma mensagem, se veio com um válido. */
export function seqOf(rumor: Pick<Rumor, 'tags'>): number | undefined {
	const value = rumor.tags.find((t) => t[0] === SEQ_TAG)?.[1];
	return value && /^[1-9]\d{0,8}$/.test(value) ? Number(value) : undefined;
}

/** A tag da minha próxima mensagem na conversa: depois do maior número que qualquer aparelho meu já usou. */
export const nextSeqTag = (conversation: Pick<ConversationRecord, 'lastSeq'> | undefined): string[][] => [
	[SEQ_TAG, String((conversation?.lastSeq ?? 0) + 1)]
];

/**
 * Anota um número que chegou de `sender`. Acima do maior visto, o que ficou no meio passa a faltar; abaixo, é um que
 * faltava (ou uma mensagem antiga). O primeiro número visto não cria buraco: pode ser de antes de eu restaurar a
 * conta ou de entrar no grupo.
 */
export function trackSeq(seqs: ConversationRecord['seqs'], sender: string, n: number, now: number): Record<string, SeqTrack> {
	const track = seqs?.[sender];
	if (!track) return { ...seqs, [sender]: { top: n, missing: [] } };
	if (n <= track.top) return { ...seqs, [sender]: { ...track, missing: track.missing.filter((m) => m.n !== n) } };
	// um salto enorme é de quem trocou de aparelho sem as cópias, não de perda: guarda só os mais próximos
	const gap = [];
	for (let k = Math.max(track.top + 1, n - MAX_RESEND_SEQS); k < n; k++) gap.push({ n: k, since: now, asked: 0 });
	return { ...seqs, [sender]: { top: n, missing: [...track.missing, ...gap].slice(-MAX_RESEND_SEQS) } };
}

/** O que já pode ser pedido de `track`: esperou a janela, ou um dia desde o último pedido. */
function due(track: SeqTrack, now: number): number[] {
	return track.missing
		.filter((m) => m.asked < MAX_ASKS && now - (m.askedAt ?? m.since) >= (m.asked ? ASK_AGAIN_S : GAP_WAIT_S))
		.map((m) => m.n);
}

export type ResendRequest = { conversationId: string; sender: string; seqs: number[] };

/**
 * Os pedidos de reenvio a fazer agora. Só a quem é contato (ou ao grupo que aceitei), como as confirmações: um pedido
 * de mensagem não ganha sinal de que estou aqui (RF-12).
 */
export async function resendRequestsDue(storage: Storage, now: number): Promise<ResendRequest[]> {
	const requests: ResendRequest[] = [];
	for (const conversation of await storage.conversations.listByRecent()) {
		if (!conversation.seqs) continue;
		if (conversation.group ? conversation.group.request || !conversation.group.amMember : false) continue;
		for (const [sender, track] of Object.entries(conversation.seqs)) {
			const seqs = due(track, now);
			if (!seqs.length) continue;
			if (!conversation.group && (await storage.contacts.get(sender))?.state !== 'aceito') continue;
			requests.push({ conversationId: conversation.id, sender, seqs });
		}
	}
	return requests;
}

/** Tags do pedido de reenvio; nos grupos, com a tag `g` para quem enviou achar a conversa. */
export function resendTags(request: ResendRequest): string[][] {
	const groupId = request.conversationId.startsWith('grupo:') ? request.conversationId.slice('grupo:'.length) : undefined;
	return [
		...request.seqs.map((n) => [SEQ_TAG, String(n)]),
		...(groupId ? [['g', groupId]] : []),
		['alt', 'pedido de reenvio do Lero-lero']
	];
}

/** Pedi o reenvio: conta a vez e esquece o que já foi pedido demais ou que passou do prazo dos relays. */
async function markAskedNow(storage: Storage, request: ResendRequest, now: number) {
	const conversation = await storage.conversations.get(request.conversationId);
	const track = conversation?.seqs?.[request.sender];
	if (!conversation || !track) return;
	const asked = new Set(request.seqs);
	const missing = track.missing
		.map((m) => (asked.has(m.n) ? { ...m, asked: m.asked + 1, askedAt: now } : m))
		.filter((m) => !(m.asked >= MAX_ASKS && now - m.askedAt! >= ASK_AGAIN_S) && now - m.since < LOSS_DEADLINE_S);
	await storage.conversations.put({ ...conversation, seqs: { ...conversation.seqs, [request.sender]: { ...track, missing } } });
}

/** Quantas mensagens minhas da conversa um pedido de reenvio procura: cobre bem os 7 dias que os relays guardam. */
const RESEND_SEARCH = 2_000;

/**
 * Pedido de reenvio que chegou: as minhas mensagens que ele cita, ainda guardadas com o rumor, a que quem pediu estava
 * endereçado. Só vale de quem está na conversa; o que eu apaguei não volta.
 */
export async function resendsFor(storage: Storage, me: string, rumor: Rumor): Promise<Rumor[]> {
	const requester = rumor.pubkey;
	if (requester === me || (await storage.contacts.get(requester))?.state === 'bloqueado') return [];
	const conversation = await conversationOf(storage, me, rumor);
	if (!conversation || (groupIdOf(rumor) && !conversation.members.includes(requester))) return [];
	const wanted = new Set(rumor.tags.filter((t) => t[0] === SEQ_TAG).slice(0, MAX_RESEND_SEQS).map((t) => seqOf({ tags: [t] })));
	wanted.delete(undefined);
	if (!wanted.size) return [];
	const messages = await storage.messages.listByConversation(conversation.id, RESEND_SEARCH);
	return messages
		.filter((m) => m.sender === me && m.rumor && !m.deleted && wanted.has(seqOf(m.rumor)))
		.map((m) => m.rumor!)
		.filter((r) => r.tags.some((t) => t[0] === 'p' && t[1] === requester));
}

/**
 * De `recipients`, quem pode não ter recebido a minha mensagem: estava nela e não confirmou nada em 7 dias (desde o
 * envio ou o último reenvio). Só mensagem com o rumor guardado, que é o que dá para reenviar.
 */
export function lostRecipients(
	message: Pick<MessageRecord, 'status' | 'receipts' | 'rumor' | 'resentAt'>,
	recipients: string[],
	now = Date.now() / 1000
): string[] {
	if (!message.rumor || message.status === 'pendente') return [];
	if (now - (message.resentAt ?? message.rumor.created_at) < LOSS_DEADLINE_S) return [];
	const addressed = new Set(message.rumor.tags.filter((t) => t[0] === 'p').map((t) => t[1]));
	return recipients.filter((r) => addressed.has(r) && !message.receipts?.[r]);
}

/** Reenviei: o prazo recomeça. */
async function markResentNow(storage: Storage, messageId: string, now: number) {
	const message = await storage.messages.get(messageId);
	if (message) await storage.messages.put({ ...message, resentAt: Math.floor(now) });
}

export const markAsked = (...args: Parameters<typeof markAskedNow>) => exclusive(args[0], () => markAskedNow(...args));
export const markResent = (...args: Parameters<typeof markResentNow>) => exclusive(args[0], () => markResentNow(...args));
