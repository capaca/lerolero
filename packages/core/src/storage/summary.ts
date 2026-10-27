// Resumo da última mensagem de uma conversa, para a lista. Sem texto de interface (ADR-0008): o tipo, o texto
// que a pessoa escreveu e, num aviso de grupo, quem fez e o quê; a tela monta "Áudio", "Ana adicionou João".
import type { ConversationRecord, MessageRecord } from './records.ts';

export const PREVIEW_LENGTH = 80;

export type ConversationSummary = Pick<ConversationRecord, 'lastMessagePreview' | 'lastMessageKind' | 'lastNotice'>;

export function kindOf(message: Pick<MessageRecord, 'media'>): 'texto' | 'audio' | 'arquivo' {
	if (!message.media) return 'texto';
	return message.media.type.startsWith('audio/') ? 'audio' : 'arquivo';
}

/** Os três campos sempre presentes (mesmo `undefined`), para substituir os do resumo anterior ao espalhar. */
export function summaryOf(message: Pick<MessageRecord, 'text' | 'media' | 'deleted' | 'notice' | 'sender'> | undefined): ConversationSummary {
	if (!message) return { lastMessagePreview: undefined, lastMessageKind: undefined, lastNotice: undefined };
	if (message.deleted) return { lastMessagePreview: undefined, lastMessageKind: 'apagada', lastNotice: undefined };
	if (message.notice) {
		return { lastMessagePreview: undefined, lastMessageKind: 'aviso', lastNotice: { author: message.sender, notice: message.notice } };
	}
	const kind = kindOf(message);
	const text = kind === 'texto' ? message.text.replace(/\s+/g, ' ').trim().slice(0, PREVIEW_LENGTH) : undefined;
	return { lastMessagePreview: text, lastMessageKind: kind, lastNotice: undefined };
}
