// Resumo da última mensagem de uma conversa, para a lista. Sem texto de interface (ADR-0008): o tipo, o texto
// que a pessoa escreveu e, num aviso de grupo, quem fez e o quê; a tela monta "Áudio", "Ana adicionou João".
import { splitMentions } from '../conversations/mentions.ts';
import type { ConversationRecord, MessageRecord } from './records.ts';

export const PREVIEW_LENGTH = 80;
/** Quanto uma menção conta na prévia: o tamanho de um "@Nome" comum. */
const MENTION_SHOWN = 10;

export type ConversationSummary = Pick<ConversationRecord, 'lastMessagePreview' | 'lastMessageKind' | 'lastNotice'>;

export function kindOf(message: Pick<MessageRecord, 'media'>): 'texto' | 'audio' | 'foto' | 'arquivo' {
	if (!message.media) return 'texto';
	if (message.media.type.startsWith('audio/')) return 'audio';
	return message.media.type.startsWith('image/') ? 'foto' : 'arquivo';
}

/** Corta no tamanho da prévia sem partir uma menção (RF-35): ela vira um nome curto na tela, então conta pouco. */
function shorten(text: string): string {
	let out = '';
	let shown = 0;
	for (const part of splitMentions(text)) {
		const size = 'mention' in part ? MENTION_SHOWN : part.text.length;
		if (shown + size > PREVIEW_LENGTH) return 'mention' in part ? out : out + part.text.slice(0, PREVIEW_LENGTH - shown);
		out += part.text;
		shown += size;
	}
	return out;
}

/** Os três campos sempre presentes (mesmo `undefined`), para substituir os do resumo anterior ao espalhar. */
export function summaryOf(message: Pick<MessageRecord, 'text' | 'media' | 'deleted' | 'notice' | 'sender'> | undefined): ConversationSummary {
	if (!message) return { lastMessagePreview: undefined, lastMessageKind: undefined, lastNotice: undefined };
	if (message.deleted) return { lastMessagePreview: undefined, lastMessageKind: 'apagada', lastNotice: undefined };
	if (message.notice) {
		return { lastMessagePreview: undefined, lastMessageKind: 'aviso', lastNotice: { author: message.sender, notice: message.notice } };
	}
	const kind = kindOf(message);
	const text = kind === 'texto' ? shorten(message.text.replace(/\s+/g, ' ').trim()) : undefined;
	return { lastMessagePreview: text, lastMessageKind: kind, lastNotice: undefined };
}
