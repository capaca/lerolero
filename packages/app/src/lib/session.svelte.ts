// Estado da sessão: se há identidade no aparelho e se ela está desbloqueada.
// As telas chamam estas funções; a chave privada fica no worker, nunca aqui.

import {
	addContact,
	connect,
	parseInvite,
	directConversationId,
	dmRelayListTemplate,
	fetchDmRelays,
	markRead,
	markSent,
	nameTagFor,
	listContacts,
	NO_FAILURES,
	openStorage,
	recordFailure,
	RelayPool,
	renameContact,
	storeIncoming,
	storeOutgoing,
	SyncEngine,
	waitTime,
	type AttemptState,
	type ContactRecord,
	type ConversationRecord,
	type IdentityRecord,
	type MessageRecord,
	type Invite,
	type Vault
} from '@lerolero/core';
import { relayList } from './relays.ts';

export type Status = 'carregando' | 'sem-identidade' | 'bloqueado' | 'desbloqueado';

const ATTEMPTS_KEY = 'tentativasPin';

/** O contato não publicou onde recebe mensagens e o convite não trouxe: não há para onde enviar. */
export class NoRelaysError extends Error {
	constructor() {
		super('Não sei onde entregar mensagens para esta pessoa');
		this.name = 'NoRelaysError';
	}
}

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
	/** muda a cada mensagem ou conversa alterada: as telas observam e recarregam */
	version = $state(0);
	/** conversa na tela agora: mensagens dela não contam como não lidas */
	openConversationId: string | undefined;
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

	/** Conecta aos relays, passa a receber, envia o que ficou na fila e publica onde recebo mensagens. */
	private async startNetwork() {
		if (this.network) return;
		const pool = new RelayPool({ signer: (template) => vault.sign(template) });
		const engine = new SyncEngine({
			storage,
			pool,
			myPublicKey: this.current.publicKey,
			events: {
				onWrap: (wrap) => this.receive(wrap),
				onSent: async (item) => {
					if (item.messageId === DM_LIST_ID) await storage.settings.set('relaysDmPublicados', relaysOf(item.event.tags));
					else if (item.messageId) {
						await markSent(storage, item.messageId);
						this.version++;
					}
				}
			}
		});
		this.network = { pool, engine };
		await engine.start(await this.myDmRelays());
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

	// ---------- conversas ----------

	private async receive(wrap: Parameters<Vault['unwrap']>[0]) {
		const rumor = await vault.unwrap(wrap);
		const stored = await storeIncoming(storage, this.current.publicKey, rumor, { openConversationId: this.openConversationId });
		if (stored?.isNew) this.version++;
	}

	/**
	 * Envia texto para um contato. A mensagem aparece na hora como "enviando" (RNF-12)
	 * e segue pela fila; sem internet, sai quando a conexão voltar.
	 */
	async sendText(recipient: string, text: string) {
		const network = this.network;
		if (!network) throw new Error('Sem conexão com a rede');
		const relays = await this.deliveryRelays(recipient);
		const tags = await nameTagFor(storage, recipient, this.current.displayName);
		const wrapped = await vault.wrapDirectMessage(recipient, text.trim(), tags);
		await storeOutgoing(storage, wrapped.rumor, recipient);
		this.version++;
		// a fila guarda e tenta de novo sozinha: a tela não espera a rede
		void network.engine.enqueue(wrapped.toRecipient, relays, wrapped.rumor.id);
		void network.engine.enqueue(wrapped.toSelf, await this.myDmRelays());
	}

	/**
	 * Onde o contato recebe: o que veio no convite; senão o kind 10050 dele na rede;
	 * senão a lista padrão, que quase todo mundo usa (o convite curto não traz relays).
	 * A reserva não é guardada no contato, para a busca ser tentada de novo da próxima vez.
	 */
	private async deliveryRelays(publicKey: string): Promise<string[]> {
		const contact = await storage.contacts.get(publicKey);
		if (contact?.dmRelays.length) return contact.dmRelays;
		const list = await relayList();
		const found = await fetchDmRelays(this.network!.pool, list.geral, publicKey);
		if (found.length) {
			if (contact) await storage.contacts.put({ ...contact, dmRelays: found });
			return found;
		}
		if (!list.dm.length) throw new NoRelaysError();
		return list.dm;
	}

	/**
	 * Conversa aberta na tela: conecta já aos relays do contato e mantém enquanto ela
	 * estiver aberta, para a primeira mensagem sair em ~200 ms em vez de ~1,5 s.
	 * Devolve a função que libera ao sair da conversa.
	 */
	async prepareConversation(publicKey: string): Promise<() => void> {
		const network = this.network;
		if (!network) return () => {};
		try {
			return network.pool.hold(await this.deliveryRelays(publicKey)).release;
		} catch {
			return () => {}; // sem relays conhecidos: o envio mostra o erro
		}
	}

	/**
	 * Comentário de teste: vai como mensagem cifrada para a conta de comentários,
	 * que entra nos contatos com um nome fixo para a resposta aparecer na conversa.
	 */
	async sendFeedback(invite: string, contactName: string, text: string): Promise<string> {
		const recipient = parseInvite(invite);
		const existing = await storage.contacts.get(recipient.publicKey);
		if (existing?.state !== 'aceito') await this.addContact(recipient, contactName);
		await this.sendText(recipient.publicKey, text);
		return recipient.publicKey;
	}

	listConversations(): Promise<ConversationRecord[]> {
		return storage.conversations.listByRecent();
	}

	getConversation(publicKey: string) {
		return storage.conversations.get(directConversationId(publicKey));
	}

	getMessages(publicKey: string, limit: number, before?: number): Promise<MessageRecord[]> {
		return storage.messages.listByConversation(directConversationId(publicKey), limit, before);
	}

	async markRead(publicKey: string) {
		await markRead(storage, directConversationId(publicKey));
		this.version++;
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
		case 'NoRelaysError':
			return 'Não sei onde entregar mensagens para esta pessoa. Peça a ela um convite novo.';
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
