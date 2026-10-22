// Estado da sessão: se há identidade no aparelho e se ela está desbloqueada.
// As telas chamam estas funções; a chave privada fica no worker, nunca aqui.

import {
	addContact,
	connect,
	dmRelayListTemplate,
	listContacts,
	NO_FAILURES,
	openStorage,
	recordFailure,
	RelayPool,
	renameContact,
	SyncEngine,
	waitTime,
	type AttemptState,
	type ContactRecord,
	type IdentityRecord,
	type Invite,
	type Vault
} from '@lerolero/core';
import { relayList } from './relays.ts';

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

const DM_LIST_ID = 'relays-dm';

class Session {
	status = $state<Status>('carregando');
	private network?: { pool: RelayPool; engine: SyncEngine };
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
		void this.startNetwork();
		return words;
	}

	async restore(phraseInput: string, pin: string, displayName: string) {
		const { publicKey, phrase } = await vault.restore(phraseInput, pin);
		// quem restaurou digitou a frase: está provado que ela foi guardada
		await this.save({ id: 'eu', publicKey, phrase, phraseConfirmed: true, displayName, createdAt: Date.now() });
		this.status = 'desbloqueado';
		void requestPersistence();
		void this.startNetwork();
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
		void this.startNetwork();
	}

	async lock() {
		this.stopNetwork();
		await vault.lock();
		this.status = 'bloqueado';
	}

	/** "Esqueci o PIN": a frase da mesma identidade cria um PIN novo; as conversas ficam. */
	async resetPin(phraseInput: string, newPin: string) {
		const phrase = await vault.resetPin(phraseInput, newPin, this.current.publicKey);
		await this.save({ ...this.current, phrase, phraseConfirmed: true });
		await storage.settings.set(ATTEMPTS_KEY, NO_FAILURES);
		this.status = 'desbloqueado';
		void this.startNetwork();
	}

	reveal(pin: string): Promise<string[]> {
		return this.withPinAttempt(() => vault.reveal(this.current.phrase, pin));
	}

	async confirmPhrase() {
		await this.save({ ...this.current, phraseConfirmed: true });
	}

	// ---------- rede ----------

	/**
	 * Conecta aos relays, envia o que ficou na fila e publica onde recebo mensagens.
	 * A recepção só liga na etapa 5, junto com a tela de conversa: ligada antes,
	 * as mensagens seriam marcadas como vistas sem ter onde ficar guardadas.
	 */
	private async startNetwork() {
		if (this.network) return;
		const pool = new RelayPool({ signer: (template) => vault.sign(template) });
		const engine = new SyncEngine({
			storage,
			pool,
			myPublicKey: this.current.publicKey,
			events: {
				onWrap: async () => {},
				onSent: async (item) => {
					if (item.messageId === DM_LIST_ID) await storage.settings.set('relaysDmPublicados', relaysOf(item.event.tags));
				}
			}
		});
		this.network = { pool, engine };
		void engine.flush();
		await this.publishDmRelays();
	}

	private stopNetwork() {
		this.network?.engine.stop();
		this.network?.pool.close();
		this.network = undefined;
	}

	/** O app voltou para a tela ou a internet voltou (RF-80). */
	resumeNetwork() {
		this.network?.engine.resume();
	}

	/** kind 10050 (NIP-17): publicado nos relays gerais e nos meus, só quando a lista muda. */
	private async publishDmRelays() {
		const relays = await this.myDmRelays();
		const published = await storage.settings.get<string[]>('relaysDmPublicados');
		if (published && published.join(' ') === relays.join(' ')) return;
		const event = await vault.sign(dmRelayListTemplate(relays));
		const general = (await relayList()).geral;
		await this.network?.engine.enqueue(event, [...general, ...relays], DM_LIST_ID);
	}

	connectedRelays(): string[] {
		return this.network?.pool.connectedUrls() ?? [];
	}

	// ---------- contatos ----------

	/**
	 * Relays onde recebo mensagens: vão no meu convite e, na etapa 4, no kind 10050.
	 * Escolhidos da lista padrão na primeira vez e guardados, para não mudarem sozinhos.
	 */
	async myDmRelays(): Promise<string[]> {
		const saved = await storage.settings.get<string[]>('meusRelaysDm');
		if (saved?.length) return saved;
		const relays = (await relayList()).dm;
		await storage.settings.set('meusRelaysDm', relays);
		return relays;
	}

	async myInvite(): Promise<Invite> {
		return { publicKey: this.current.publicKey, name: this.current.displayName, relays: await this.myDmRelays() };
	}

	addContact(invite: Invite, localName?: string): Promise<ContactRecord> {
		return addContact(storage.contacts, invite, { myPublicKey: this.current.publicKey, localName });
	}

	getContact(publicKey: string) {
		return storage.contacts.get(publicKey);
	}

	listContacts() {
		return listContacts(storage.contacts);
	}

	renameContact(publicKey: string, localName: string) {
		return renameContact(storage.contacts, publicKey, localName);
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
		case 'InvalidInviteError':
			return `${e.message ?? 'Convite inválido'}.`;
		case 'SelfInviteError':
			return 'Este é o seu próprio convite.';
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

const relaysOf = (tags: string[][]) => tags.filter((t) => t[0] === 'relay').map((t) => t[1]);
