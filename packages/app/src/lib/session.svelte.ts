// Estado da sessão: se há identidade no aparelho e se ela está desbloqueada.
// As telas chamam estas funções; a chave privada fica no worker, nunca aqui.

import {
	connect,
	NO_FAILURES,
	openStorage,
	recordFailure,
	waitTime,
	type AttemptState,
	type IdentityRecord,
	type Vault
} from '@lerolero/core';

export type Status = 'carregando' | 'sem-identidade' | 'bloqueado' | 'desbloqueado';

const ATTEMPTS_KEY = 'tentativasPin';

/** Muitos PINs errados: precisa esperar `waitMs` para tentar de novo. */
export class PinLockedError extends Error {
	constructor(readonly waitMs: number) {
		super('Muitas tentativas de PIN');
		this.name = 'PinLockedError';
	}
}

const storage = openStorage();
const vault = connect<Vault>(new Worker(new URL('./core.worker.ts', import.meta.url), { type: 'module' }));

/** Pede ao navegador para não apagar os dados do app sob pressão de espaço (ADR-0003). */
async function requestPersistence() {
	try {
		const granted = await navigator.storage?.persist?.();
		await storage.settings.set('armazenamentoPersistente', granted ?? false);
	} catch {
		// navegadores sem a API: o lembrete da frase continua sendo a proteção
	}
}

class Session {
	status = $state<Status>('carregando');
	// $state.raw: o registro tem bytes que vão para o worker e para o IndexedDB, que não aceitam proxies
	identity = $state.raw<IdentityRecord | undefined>();

	async init() {
		this.identity = await storage.identity.get();
		this.status = this.identity ? 'bloqueado' : 'sem-identidade';
	}

	private async save(identity: IdentityRecord) {
		await storage.identity.put(identity);
		this.identity = identity;
	}

	private get current(): IdentityRecord {
		if (!this.identity) throw new Error('Não há identidade neste aparelho');
		return this.identity;
	}

	/** Cria a identidade e devolve as 12 palavras, para mostrar uma única vez. */
	async create(displayName: string, pin: string): Promise<string[]> {
		const { publicKey, phrase, words } = await vault.create(pin);
		await this.save({ id: 'eu', publicKey, phrase, phraseConfirmed: false, displayName, createdAt: Date.now() });
		this.status = 'desbloqueado';
		void requestPersistence();
		return words;
	}

	async restore(phraseInput: string, pin: string, displayName: string) {
		const { publicKey, phrase } = await vault.restore(phraseInput, pin);
		// quem restaurou digitou a frase: está provado que ela foi guardada
		await this.save({ id: 'eu', publicKey, phrase, phraseConfirmed: true, displayName, createdAt: Date.now() });
		this.status = 'desbloqueado';
		void requestPersistence();
	}

	/**
	 * Toda checagem de PIN passa por aqui: o contador de erros é único para o
	 * desbloqueio e para "ver minha frase", e fica guardado no aparelho.
	 */
	private async withPinAttempt<T>(check: () => Promise<T>): Promise<T> {
		const state = (await storage.settings.get<AttemptState>(ATTEMPTS_KEY)) ?? NO_FAILURES;
		const wait = waitTime(state, Date.now());
		if (wait > 0) throw new PinLockedError(wait);
		try {
			const result = await check();
			await storage.settings.set(ATTEMPTS_KEY, NO_FAILURES);
			return result;
		} catch (err) {
			if ((err as Error).name !== 'WrongPinError') throw err;
			const next = recordFailure(state, Date.now());
			await storage.settings.set(ATTEMPTS_KEY, next);
			const nextWait = waitTime(next, Date.now());
			throw nextWait > 0 ? new PinLockedError(nextWait) : err;
		}
	}

	async unlock(pin: string) {
		await this.withPinAttempt(() => vault.unlock(this.current.phrase, pin));
		this.status = 'desbloqueado';
	}

	async lock() {
		await vault.lock();
		this.status = 'bloqueado';
	}

	/** "Esqueci o PIN": a frase da mesma identidade cria um PIN novo; as conversas ficam. */
	async resetPin(phraseInput: string, newPin: string) {
		const phrase = await vault.resetPin(phraseInput, newPin, this.current.publicKey);
		await this.save({ ...this.current, phrase, phraseConfirmed: true });
		await storage.settings.set(ATTEMPTS_KEY, NO_FAILURES);
		this.status = 'desbloqueado';
	}

	reveal(pin: string): Promise<string[]> {
		return this.withPinAttempt(() => vault.reveal(this.current.phrase, pin));
	}

	async confirmPhrase() {
		await this.save({ ...this.current, phraseConfirmed: true });
	}

	getSetting<T>(key: string) {
		return storage.settings.get<T>(key);
	}

	setSetting(key: string, value: unknown) {
		return storage.settings.set(key, value);
	}
}

export const session = new Session();

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
