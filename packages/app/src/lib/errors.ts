// Erros da sessão e o texto que a tela mostra para cada erro, inclusive os que vêm do worker.

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

/** Mensagem amigável para os erros que vêm do worker (o nome do erro atravessa o RPC). */
export function friendlyError(err: unknown): string {
	const e = err as { name?: string; message?: string };
	switch (e?.name) {
		case 'WrongPinError':
			return 'PIN incorreto.';
		case 'PinLockedError':
			return `PIN incorreto muitas vezes. Tente de novo em ${formatWait((err as PinLockedError).waitMs)}, ou use "Esqueci o PIN".`;
		case 'InvalidPinError':
			return 'O PIN precisa ter 6 números.';
		case 'PhraseMismatchError':
			return 'Esta frase é de outra conta, não da que está neste aparelho.';
		case 'InvalidPhraseError':
			return e.message ?? 'Frase inválida.';
		case 'InvalidInviteError':
			return `${e.message ?? 'Convite inválido'}.`;
		case 'SelfInviteError':
			return 'Este é o seu próprio convite.';
		case 'BlossomError':
			return 'Não foi possível enviar o arquivo agora. Verifique a internet e tente de novo.';
		case 'NoOpusError':
			return 'Este aparelho não grava áudio no formato do app. No iPhone, é preciso o iOS 18.4 ou mais novo.';
		case 'NotAllowedError':
			return 'O app não tem permissão para usar o microfone. Libere nas configurações do navegador.';
		case 'NoRelaysError':
			return 'Não sei onde entregar mensagens para esta pessoa. Peça a ela um convite novo.';
		case 'NotInGroupError':
			return 'Você não faz mais parte deste grupo.';
		case 'GroupPermissionError':
			return 'Só os administradores do grupo podem fazer isso.';
		default:
			return 'Algo deu errado. Tente de novo.';
	}
}

function formatWait(ms: number): string {
	const s = Math.ceil(ms / 1000);
	if (s < 60) return `${s} segundos`;
	const m = Math.ceil(s / 60);
	return m === 1 ? '1 minuto' : `${m} minutos`;
}
