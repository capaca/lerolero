// Editar mensagem (RF-24, kind 4443, docs/06 §3.2): quem escreveu troca o texto em até 15 minutos. O balão mostra
// "editada" e o texto novo; o antigo não fica guardado (decidido em 2026-10-29).

import { EDIT_KIND, MAX_TEXT_LENGTH, type Rumor } from '../identity/vault.ts';
import type { Storage } from '../storage/repositories.ts';
import type { MessageRecord } from '../storage/records.ts';
import { summaryOf } from '../storage/summary.ts';
import { conversationOf } from './interactions.ts';
import { exclusive } from './lock.ts';

/** Prazo para editar, em segundos (decidido em 2026-10-29, como o WhatsApp). */
export const EDIT_WINDOW_S = 15 * 60;
/** Folga para o relógio de quem editou estar um pouco à frente do meu ao conferir o prazo. */
const CLOCK_SLACK_S = 60;
/** Edições que chegaram antes da mensagem (a ordem dos embrulhos varia): ficam esperando, até este tanto. */
const HELD_KEY = 'edicoesEsperando';
const MAX_HELD = 200;

type Edit = { id: string; target: string; sender: string; conversationId: string; text: string; createdAt: number };

export const editTags = (message: Pick<MessageRecord, 'id'>): string[][] => [
	['e', message.id],
	['k', '14'],
	['alt', 'mensagem editada no Lero-lero']
];

/** Só texto meu, ainda no prazo, que não foi apagado nem é aviso. */
export function canEdit(message: MessageRecord, me: string, now = Date.now()): boolean {
	return (
		message.sender === me &&
		message.kind === 14 &&
		!message.deleted &&
		!message.notice &&
		Math.floor(now / 1000) - message.createdAt <= EDIT_WINDOW_S
	);
}

/** Aplica a edição se vier de quem escreveu, no prazo e mais nova que a anterior. Devolve a mensagem editada. */
async function apply(storage: Storage, message: MessageRecord, edit: Edit): Promise<MessageRecord | undefined> {
	if (message.sender !== edit.sender || message.conversationId !== edit.conversationId) return undefined;
	if (message.kind !== 14 || message.deleted || message.notice) return undefined;
	if (edit.createdAt - message.createdAt > EDIT_WINDOW_S + CLOCK_SLACK_S || edit.createdAt < message.createdAt) return undefined;
	if (message.editedAt && message.editedAt >= edit.createdAt) return undefined;
	const edited: MessageRecord = { ...message, text: edit.text, editedAt: edit.createdAt };
	await storage.messages.put(edited);
	// a prévia da lista só muda se a editada é a mais recente
	const conversation = await storage.conversations.get(message.conversationId);
	if (conversation && message.createdAt >= conversation.lastMessageAt) await storage.conversations.put({ ...conversation, ...summaryOf(edited) });
	return edited;
}

/** Edição recebida (de quem está na conversa, ou minha de outro aparelho). */
async function storeEditNow(storage: Storage, me: string, rumor: Rumor): Promise<MessageRecord | undefined> {
	if (rumor.kind !== EDIT_KIND) return undefined;
	const target = rumor.tags.find((t) => t[0] === 'e')?.[1];
	const text = rumor.content.trim();
	if (!target || !/^[0-9a-f]{64}$/.test(target) || !text || text.length > MAX_TEXT_LENGTH) return undefined;
	if (rumor.pubkey !== me && (await storage.contacts.get(rumor.pubkey))?.state === 'bloqueado') return undefined;
	const conversation = await conversationOf(storage, me, rumor);
	if (!conversation) return undefined;
	const edit: Edit = { id: rumor.id, target, sender: rumor.pubkey, conversationId: conversation.id, text, createdAt: rumor.created_at };
	const message = await storage.messages.get(target);
	if (message) return apply(storage, message, edit);
	const held = (await storage.settings.get<Edit[]>(HELD_KEY)) ?? [];
	if (!held.some((e) => e.id === edit.id)) await storage.settings.set(HELD_KEY, [...held, edit].slice(-MAX_HELD));
	return undefined;
}

/** A mensagem acabou de chegar: aplica as edições que esperavam por ela. Quem chama já tem a vez (lock.ts). */
export async function applyHeldEdits(storage: Storage, message: MessageRecord): Promise<MessageRecord> {
	const held = (await storage.settings.get<Edit[]>(HELD_KEY)) ?? [];
	const mine = held.filter((e) => e.target === message.id).sort((a, b) => a.createdAt - b.createdAt);
	if (!mine.length) return message;
	let current = message;
	for (const edit of mine) current = (await apply(storage, current, edit)) ?? current;
	await storage.settings.set(HELD_KEY, held.filter((e) => e.target !== message.id));
	return current;
}

/** Minha edição: aplica aqui antes de mandar (aparece na hora, RNF-12). */
async function editMineNow(storage: Storage, me: string, messageId: string, text: string, now = Date.now()): Promise<MessageRecord> {
	const message = await storage.messages.get(messageId);
	const clean = text.trim();
	if (!message || !canEdit(message, me, now)) throw new Error('mensagem que não dá mais para editar');
	if (!clean || clean.length > MAX_TEXT_LENGTH) throw new Error('mensagem vazia ou longa demais');
	if (clean === message.text) return message;
	const edited = await apply(storage, message, {
		id: '',
		target: messageId,
		sender: me,
		conversationId: message.conversationId,
		text: clean,
		createdAt: Math.max(Math.floor(now / 1000), (message.editedAt ?? message.createdAt) + 1)
	});
	return edited ?? message;
}

export const storeEdit = (...args: Parameters<typeof storeEditNow>) => exclusive(args[0], () => storeEditNow(...args));
export const editMine = (...args: Parameters<typeof editMineNow>) => exclusive(args[0], () => editMineNow(...args));
