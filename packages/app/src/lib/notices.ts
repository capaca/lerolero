// Nomes dos membros e texto dos avisos de grupo, na língua da interface (ADR-0008). O core guarda só o aviso
// estruturado (ação, alvos, nome do grupo) e quem é cada membro; a frase é montada aqui, na hora de mostrar.
import type { ConversationRecord, GroupNotice, MemberName } from '@lerolero/core';
import { intlLocale } from '#lib/i18n.svelte.ts';
import { m } from '#lib/paraglide/messages.js';

export type NameOf = (publicKey: string) => MemberName | undefined;

/** "Você"; o nome do contato; "~Nome" para quem não é contato (pode ter escolhido qualquer nome); "Alguém". */
export function memberName(name: MemberName | undefined, inSentence = false): string {
	if (!name) return m.membro_alguem();
	if (name.me) return inSentence ? m.membro_voce_no_meio() : m.membro_voce();
	return name.contact ? name.name : `~${name.name}`;
}

/** "Ana, Bruno e Carla", com o "e" da língua. */
const listNames = (names: string[]) => new Intl.ListFormat(intlLocale(), { type: 'conjunction' }).format(names);

export function noticeText(notice: GroupNotice, author: string, nameOf: NameOf): string {
	const who = memberName(nameOf(author));
	const targets = listNames(notice.targets.map((k) => memberName(nameOf(k), true)));
	const group = notice.subject ?? '';
	switch (notice.action) {
		case 'criar':
			return m.aviso_criou({ quem: who, grupo: group });
		case 'adicionar':
			return m.aviso_adicionou({ quem: who, alvos: targets });
		case 'remover':
			return notice.targets[0] === author ? m.aviso_saiu({ quem: who }) : m.aviso_removeu({ quem: who, alvos: targets });
		case 'sair':
			return m.aviso_saiu({ quem: who });
		case 'renomear':
			return m.aviso_renomeou({ quem: who, grupo: group });
		case 'promover':
			return m.aviso_promoveu({ quem: who, alvos: targets });
		case 'rebaixar':
			return m.aviso_rebaixou({ quem: who, alvos: targets });
		default:
			return m.aviso_mudou({ quem: who });
	}
}

/** Texto da última mensagem na lista; o ícone de áudio e arquivo fica com a tela. */
export function previewText(conversation: ConversationRecord, nameOf?: NameOf): string {
	switch (conversation.lastMessageKind) {
		case 'audio':
			return m.previa_audio();
		case 'arquivo':
			return m.previa_arquivo();
		case 'apagada':
			return m.previa_apagada();
		case 'aviso': {
			const last = conversation.lastNotice;
			return last ? noticeText(last.notice, last.author, nameOf ?? (() => undefined)) : '';
		}
		default:
			return conversation.lastMessagePreview ?? '';
	}
}
