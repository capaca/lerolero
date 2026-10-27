// Erros da sessão e o texto que a tela mostra para cada erro, inclusive os que vêm do worker.
// As mensagens dos erros são para quem programa; a tela usa as traduções (ADR-0008).

import { PHRASE_LENGTH, type InviteProblem, type PhraseProblem } from '@lerolero/core';
import { m } from '#lib/paraglide/messages.js';

/** O contato não publicou onde recebe mensagens e o convite não trouxe: não há para onde enviar. */
export class NoRelaysError extends Error {
	constructor() {
		super('Não sei onde entregar mensagens para esta pessoa');
		this.name = 'NoRelaysError';
	}
}

/** Saí ou fui removido do grupo: não dá mais para mandar nada nele. */
export class NotInGroupError extends Error {
	constructor() {
		super('Você não faz mais parte deste grupo');
		this.name = 'NotInGroupError';
	}
}

/** Muitos PINs errados: precisa esperar `waitMs` para tentar de novo. */
export class PinLockedError extends Error {
	constructor(readonly waitMs: number) {
		super('Muitas tentativas de PIN');
		this.name = 'PinLockedError';
	}
}

/** Mensagem amigável para os erros que vêm do worker (o nome do erro atravessa o RPC, e o `detail` também). */
export function friendlyError(err: unknown): string {
	const e = err as { name?: string; detail?: unknown };
	switch (e?.name) {
		case 'WrongPinError':
			return m.erro_pin_incorreto();
		case 'PinLockedError':
			return m.erro_pin_bloqueado({ espera: formatWait((err as PinLockedError).waitMs) });
		case 'InvalidPinError':
			return m.erro_pin_tamanho();
		case 'PhraseMismatchError':
			return m.erro_frase_outra_conta();
		case 'InvalidPhraseError':
			return phraseProblem(e.detail as PhraseProblem | undefined);
		case 'InvalidInviteError':
			return inviteProblem(e.detail as InviteProblem | undefined);
		case 'SelfInviteError':
			return m.erro_convite_proprio();
		case 'BlossomError':
			return m.erro_arquivo();
		case 'NoOpusError':
			return m.erro_sem_opus();
		case 'NotAllowedError':
			return m.erro_microfone();
		case 'NoRelaysError':
			return m.erro_sem_relays();
		case 'NotInGroupError':
			return m.erro_fora_do_grupo();
		case 'GroupPermissionError':
			return m.erro_so_admin();
		default:
			return m.erro_generico();
	}
}

function phraseProblem(problem?: PhraseProblem): string {
	switch (problem?.reason) {
		case 'tamanho':
			return m.erro_frase_tamanho({ count: problem.count, total: PHRASE_LENGTH });
		case 'palavra':
			return m.erro_frase_palavra({ position: problem.position, word: problem.word });
		case 'soma':
			return m.erro_frase_soma();
		default:
			return m.erro_frase_invalida();
	}
}

function inviteProblem(problem?: InviteProblem): string {
	switch (problem?.reason) {
		case 'formato':
			return m.erro_convite_formato();
		case 'nao-e-pessoa':
			return m.erro_convite_nao_pessoa();
		default:
			return m.erro_convite_invalido();
	}
}

function formatWait(ms: number): string {
	const s = Math.ceil(ms / 1000);
	if (s < 60) return m.espera_segundos({ count: s });
	return m.espera_minutos({ count: Math.ceil(s / 60) });
}
