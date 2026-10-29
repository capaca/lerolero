// Estado da sessão: se há identidade no aparelho e se ela está desbloqueada.
// As telas chamam estas funções; a chave privada fica no worker, nunca aqui.

import {
	acceptRequest,
	acceptGroupRequest,
	blockContact,
	blockGroupRequest,
	listGroupRequests,
	listBlocked,
	listRequests,
	unblockContact,
	addContact,
	connect,
	addMembers,
	createGroup,
	demoteAdmin,
	leaveGroup,
	promoteAdmin,
	removeMember,
	renameGroup,
	GROUP_CONTROL_KIND,
	groupNames,
	introduce,
	storeGroupControl,
	takeForwards,
	type GroupChange,
	type StoredGroupChange,
	deleteConversation,
	deleteForMe,
	contactName,
	deletionTags,
	forwardOf,
	markAcknowledged,
	MAX_RECEIPT_IDS,
	REACTION_KIND,
	reactionTags,
	RECEIPT_KIND,
	receiptsDue,
	removeReactions,
	replyTags,
	storeReaction,
	storeReceipt,
	type MessageKind,
	type Receipt,
	type ReactionRecord,
	parseInvite,
	directConversationId,
	groupConversationId,
	dmRelayListTemplate,
	fetchDmRelays,
	markDeleted,
	markRead,
	markSent,
	setStarred,
	toNpub,
	mediaTags,
	nameTagFor,
	openMedia,
	startPendingPhoto,
	discardPendingUpload,
	listPendingUploads,
	retryPendingUpload,
	startPendingAudio,
	tryPendingUpload,
	listContacts,
	NO_FAILURES,
	openStorage,
	recordFailure,
	RelayPool,
	removeFromBlossom,
	renameContact,
	storeIncoming,
	sendTime,
	storeOutgoing,
	cleanName,
	markProfileSent,
	photoAllowed,
	prepareMedia,
	PROFILE_FEATURES,
	PROFILE_KIND,
	profileAudience,
	profileDue,
	profileEvent,
	storeProfile,
	type ProfileRecord,
	sessionIsOpen,
	SyncEngine,
	upgradeSyncGeneration,
	waitTime,
	type AttemptState,
	type ContactRecord,
	type ConversationRecord,
	type IdentityRecord,
	type MessageMedia,
	type MessageRecord,
	type Invite,
	type OpenSession,
	type Vault
} from '@lerolero/core';
import { NoRelaysError, NotInGroupError, PinLockedError } from './errors.ts';
import { prepareFromFile, prepareProfileFromFile } from './photo-encoder.ts';
import { m } from '#lib/paraglide/messages.js';
import { memberName } from './notices.ts';
import { relayList } from './relays.ts';

export type Status = 'carregando' | 'sem-identidade' | 'bloqueado' | 'desbloqueado';

const ATTEMPTS_KEY = 'tentativasPin';
const OPEN_SESSION_KEY = 'sessaoAberta';
export const READ_RECEIPTS_KEY = 'confirmacaoLeitura';
/** Espera para juntar as confirmações que chegam em sequência num evento só. */
const ACK_DELAY_MS = 1500;

const storage = openStorage();
const vault = connect<Vault>(new Worker(new URL('./core.worker.ts', import.meta.url), { type: 'module' }));

const PERSIST_KEY = 'armazenamentoPersistente';
const PERSIST_TRIED_KEY = 'armazenamentoPersistenteTentadoEm';
const PERSIST_RETRY_MS = 24 * 60 * 60 * 1000;

/**
 * Pede ao navegador para não apagar os dados do app sob pressão de espaço (ADR-0003, T19). O Chrome decide pelo
 * uso do site, e no cadastro ele quase sempre nega; por isso a cada desbloqueio tenta de novo, no máximo uma vez
 * por dia (o Firefox pergunta à pessoa a cada pedido).
 */
async function requestPersistence() {
	try {
		if (await navigator.storage?.persisted?.()) return void (await storage.settings.set(PERSIST_KEY, true));
		const triedAt = (await storage.settings.get<number>(PERSIST_TRIED_KEY)) ?? 0;
		if (Date.now() - triedAt < PERSIST_RETRY_MS) return;
		await storage.settings.set(PERSIST_TRIED_KEY, Date.now());
		const granted = await navigator.storage?.persist?.();
		await storage.settings.set(PERSIST_KEY, granted ?? false);
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
	/** onde recebem as pessoas que não são contatos (membros de grupo), achado nesta sessão */
	private foundRelays = new Map<string, string[]>();
	/** gravação da sessão aberta em andamento: bloquear espera, senão ela voltaria depois de apagada */
	private savingSession?: Promise<void>;
	/** fila de envios (sendTo) */
	private sending: Promise<unknown> = Promise.resolve();
	/** sem internet, ou sem nenhum relay conectado há alguns segundos: a tela avisa que as mensagens ficam na fila */
	offline = $state(false);
	private noRelaysSince?: number;
	private connectionTimer?: ReturnType<typeof setInterval>;
	/** áudios subindo agora e o aviso da próxima tentativa de cada um que falhou */
	private uploading = new Set<string>();
	private uploadTimers = new Map<string, ReturnType<typeof setTimeout>>();
	/**
	 * Fotos de perfil para o Avatar, por chave: a foto baixada ou, enquanto não baixa, a prévia do cartão. Só de
	 * quem a foto pode aparecer (contato aceito, grupo comigo e eu mesmo; de pedido não, T9).
	 */
	photos = $state<Record<string, string>>({});
	private photoUrls = new Map<string, string>();
	private downloadingPhotos = new Set<string>();

	async init() {
		this.identity = await storage.identity.get();
		if (!this.identity) this.status = 'sem-identidade';
		else if (await this.resumeOpenSession()) this.unlocked();
		else this.status = 'bloqueado';
	}

	/** Desbloqueado: entra e conecta. Também guarda a sessão, para recarregar sem pedir o PIN. */
	private unlocked() {
		this.status = 'desbloqueado';
		void requestPersistence();
		void this.startNetwork();
		this.savingSession = vault
			.openSession(Date.now())
			.then((open) => storage.settings.set(OPEN_SESSION_KEY, open))
			.catch(() => {}); // sem sessão, só pede o PIN na próxima recarga
	}

	/** Recarregou a página pouco depois de usar o app (SESSION_IDLE_MS): entra sem o PIN. */
	private async resumeOpenSession(): Promise<boolean> {
		const open = await storage.settings.get<OpenSession>(OPEN_SESSION_KEY);
		if (!open) return false;
		try {
			if (sessionIsOpen(open, Date.now()) && (await vault.resumeSession(open)) === this.current.publicKey) return true;
		} catch {
			// sessão estragada: cai no PIN
		}
		await vault.lock();
		await storage.settings.set(OPEN_SESSION_KEY, undefined);
		return false;
	}

	/** O app está em uso: o prazo da sessão aberta conta a partir de agora. */
	async touchSession() {
		if (this.status !== 'desbloqueado') return;
		const open = await storage.settings.get<OpenSession>(OPEN_SESSION_KEY);
		if (open) await storage.settings.set(OPEN_SESSION_KEY, { ...open, lastSeen: Date.now() });
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
		this.unlocked();
		return words;
	}

	async restore(phraseInput: string, pin: string, displayName: string) {
		const { publicKey, phrase } = await vault.restore(phraseInput, pin);
		// quem restaurou digitou a frase: está provado que ela foi guardada
		await this.save({ id: 'eu', publicKey, phrase, phraseConfirmed: true, displayName, createdAt: Date.now() });
		this.unlocked();
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
		this.unlocked();
	}

	async lock() {
		this.stopNetwork();
		await this.savingSession;
		await storage.settings.set(OPEN_SESSION_KEY, undefined);
		await vault.lock();
		this.clearPhotos();
		this.status = 'bloqueado';
	}

	/** "Esqueci o PIN": a frase da mesma identidade cria um PIN novo; as conversas ficam. */
	async resetPin(phraseInput: string, newPin: string) {
		const phrase = await vault.resetPin(phraseInput, newPin, this.current.publicKey);
		await this.save({ ...this.current, phrase, phraseConfirmed: true });
		await storage.settings.set(ATTEMPTS_KEY, NO_FAILURES);
		this.unlocked();
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
			// sem internet no aparelho a fila espera, sem gastar tentativas (a espera crescente só vale com internet)
			canSend: () => navigator.onLine,
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
		// versão nova que entende tipos novos de mensagem: recupera o que a antiga ignorou
		await upgradeSyncGeneration(storage);
		await engine.start(await this.myDmRelays());
		void this.resumeUploads();
		void this.refreshPhotos();
		this.watchConnection();
		await this.publishDmRelays();
	}

	/**
	 * Só avisa depois de uns segundos sem relay (RELAYS_GRACE_MS): ao abrir o app a conexão leva um instante e
	 * um relay que cai e volta não deve piscar o aviso. Sem internet no aparelho, avisa na hora.
	 */
	private watchConnection() {
		const RELAYS_GRACE_MS = 6_000;
		const check = () => {
			if (!this.network) return;
			if (!navigator.onLine) return void (this.offline = true);
			if (this.network.pool.connectedUrls().length > 0) {
				this.noRelaysSince = undefined;
				return void (this.offline = false);
			}
			this.noRelaysSince ??= Date.now();
			this.offline = Date.now() - this.noRelaysSince >= RELAYS_GRACE_MS;
		};
		clearInterval(this.connectionTimer);
		this.connectionTimer = setInterval(check, 1_000);
		addEventListener('offline', check);
		addEventListener('online', check);
		this.stopWatchingConnection = () => {
			clearInterval(this.connectionTimer);
			removeEventListener('offline', check);
			removeEventListener('online', check);
			this.noRelaysSince = undefined;
			this.offline = false;
		};
		check();
	}

	private stopWatchingConnection = () => {};

	private stopNetwork() {
		this.stopWatchingConnection();
		this.uploadTimers.forEach(clearTimeout);
		this.uploadTimers.clear();
		this.network?.engine.stop();
		this.network?.pool.close();
		this.network = undefined;
	}

	/** O app voltou para a tela ou a internet voltou (RF-80). */
	resumeNetwork() {
		this.network?.engine.resume();
		void this.resumeUploads();
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
		if (rumor.kind === GROUP_CONTROL_KIND) return this.receiveGroupControl(rumor);
		const me = this.current.publicKey;
		if (rumor.kind === PROFILE_KIND) {
			const card = await storeProfile(storage, me, rumor);
			if (card) {
				this.version++;
				await this.refreshPhoto(card.publicKey);
			}
			return;
		}
		if (rumor.kind === REACTION_KIND) {
			if (await storeReaction(storage, me, rumor)) this.version++;
			return;
		}
		if (rumor.kind === RECEIPT_KIND) {
			const readReceipts = await this.readReceiptsOn();
			if (await storeReceipt(storage, me, rumor, { readReceipts })) this.version++;
			return;
		}
		const stored = await storeIncoming(storage, me, rumor, { openConversationId: this.openConversationId });
		if (rumor.kind === 5 && (await removeReactions(storage, rumor))) this.version++;
		if (stored?.isNew) {
			this.version++;
			// chegou aqui: "entregue" (RF-50); a "lida" vem quando a conversa aparece na tela
			if (stored.message.sender !== me && !stored.message.notice) void this.acknowledge([stored.message.id], 'entregue');
		}
	}

	// ---------- confirmações de entrega e leitura (RF-50, 51) ----------

	/** Confirmação de leitura ligada por padrão (RF-51). */
	async readReceiptsOn(): Promise<boolean> {
		return (await storage.settings.get<boolean>(READ_RECEIPTS_KEY)) !== false;
	}

	private pendingAcks = new Map<string, Record<Receipt, Set<string>>>();
	private ackTimer?: ReturnType<typeof setTimeout>;

	/**
	 * Confirma ao remetente que as mensagens chegaram ou foram lidas. Agrupa por um instante, para uma conversa que
	 * chega de uma vez gerar um evento só, e só confirma a contato (receiptsDue). Com a leitura desligada, a "lida"
	 * não sai (e as dos outros também não contam, RF-51).
	 */
	async acknowledge(messageIds: string[], status: Receipt) {
		if (!messageIds.length || !this.network) return;
		const due = await receiptsDue(storage, this.current.publicKey, messageIds, status);
		if (status === 'lida' && !(await this.readReceiptsOn())) {
			// o remetente segue sabendo que chegou, mas não que li; guarda para não reavaliar a cada abertura
			for (const ids of due.values()) await markAcknowledged(storage, ids, 'lida');
			return;
		}
		for (const [sender, ids] of due) {
			const entry = this.pendingAcks.get(sender) ?? { entregue: new Set(), lida: new Set() };
			for (const id of ids) entry[status].add(id);
			this.pendingAcks.set(sender, entry);
		}
		if (due.size) this.ackTimer ??= setTimeout(() => void this.flushAcks(), ACK_DELAY_MS);
	}

	private async flushAcks() {
		this.ackTimer = undefined;
		const batch = [...this.pendingAcks];
		this.pendingAcks.clear();
		for (const [sender, entry] of batch) {
			// quem já vai receber "lida" não precisa de "entregue" (lida vale pelas duas)
			const delivered = [...entry.entregue].filter((id) => !entry.lida.has(id));
			for (const [status, ids] of [['entregue', delivered], ['lida', [...entry.lida]]] as const) {
				for (let i = 0; i < ids.length; i += MAX_RECEIPT_IDS) {
					const chunk = ids.slice(i, i + MAX_RECEIPT_IDS);
					try {
						await this.sendReceipt(sender, chunk, status);
						await markAcknowledged(storage, chunk, status);
					} catch {
						// sem rede ou sem relays: a próxima abertura da conversa tenta de novo (a "entregue" se perde, a "lida" cobre)
					}
				}
			}
		}
	}

	/** Um evento de confirmação só para quem escreveu as mensagens (nos grupos também: os outros não precisam saber). */
	private async sendReceipt(recipient: string, ids: string[], status: Receipt) {
		const network = this.requireNetwork();
		const tags = [...ids.map((id) => ['e', id]), ['status', status], ['alt', 'confirmação de entrega do Lero-lero']];
		const wrapped = await vault.wrapDirectMessage(recipient, '', tags, RECEIPT_KIND);
		await network.engine.enqueue(wrapped.toRecipient, await this.relaysOrDefault(recipient));
	}

	/** A conversa apareceu na tela: confirma como lidas as mensagens dos outros que ainda não confirmei. */
	acknowledgeRead(messageIds: string[]) {
		return this.acknowledge(messageIds, 'lida');
	}

	/** Aviso de grupo: atualiza o grupo, me apresento a quem entrou e repasso o que faltou (docs/06 §3.3). */
	private async receiveGroupControl(rumor: Awaited<ReturnType<Vault['unwrap']>>) {
		const me = this.current.publicKey;
		const change = await storeGroupControl(storage, me, rumor);
		if (!change?.isNew) return;
		this.version++;
		// quem entrou no grupo passa a poder aparecer com foto
		void this.refreshPhotos();
		// avisos meus vindos de outro aparelho: lá já me apresentei
		if (rumor.pubkey !== me) await this.afterGroupChange(change);
	}

	private async afterGroupChange({ conversation, joined, newMembers }: StoredGroupChange) {
		// grupo que ainda é pedido (RF-12): não me apresento nem repasso nada até aceitar, para não confirmar que estou aqui (T7)
		if (!conversation.group?.amMember || conversation.group.request) return;
		const myName = this.current.displayName;
		if (joined) await this.sendGroupChange(introduce(conversation, myName));
		else if (newMembers.length) await this.sendGroupChange(introduce(conversation, myName, newMembers));
		// o cartão vai junto da apresentação (Q-P5)
		void this.sendProfile(joined ? conversation.members : newMembers);
		for (const { rumor, to } of await takeForwards(storage, conversation, this.current.publicKey)) {
			for (const { recipient, wrap } of await vault.rewrapGroupControl(rumor, to)) void this.enqueueTo(recipient, wrap);
		}
	}

	/** Embrulha um aviso de grupo meu, aplica aqui e manda a cada membro (e aos meus outros aparelhos). */
	private async sendGroupChange(change: GroupChange) {
		const network = this.requireNetwork();
		const wrapped = await vault.wrapGroupMessage(change.recipients, '', change.tags, GROUP_CONTROL_KIND, change.createdAt);
		await storeGroupControl(storage, this.current.publicKey, wrapped.rumor);
		this.version++;
		// os relays de todos são buscados antes de devolver e a fila recebe os avisos na sequência: se a página
		// recarregasse no meio da busca solta, o aviso sumia e o membro nunca era adicionado ao grupo
		const relays = await Promise.all(wrapped.toRecipients.map(({ recipient }) => this.relaysOrDefault(recipient)));
		const mine = await this.myDmRelays();
		wrapped.toRecipients.forEach(({ wrap }, i) => void network.engine.enqueue(wrap, relays[i]));
		void network.engine.enqueue(wrapped.toSelf, mine);
	}

	/** Cria um grupo (RF-31) e devolve o id da conversa. */
	async createGroup(name: string, members: string[]): Promise<string> {
		const change = createGroup(this.current.publicKey, name, members, this.current.displayName);
		await this.sendGroupChange(change);
		return groupConversationId(change.groupId);
	}

	/** Gestão do grupo (RF-31, RF-32): as regras de permissão são conferidas no core antes de enviar. */
	private async manageGroup(
		conversationId: string,
		build: (conversation: ConversationRecord, me: string, myName: string) => GroupChange
	) {
		const conversation = await storage.conversations.get(conversationId);
		if (!conversation?.group?.amMember) throw new NotInGroupError();
		await this.sendGroupChange(build(conversation, this.current.publicKey, this.current.displayName));
	}

	addToGroup(conversationId: string, publicKeys: string[]) {
		return this.manageGroup(conversationId, (c, me, name) => addMembers(c, me, publicKeys, name));
	}

	removeFromGroup(conversationId: string, publicKey: string) {
		return this.manageGroup(conversationId, (c, me, name) => removeMember(c, me, publicKey, name));
	}

	setGroupAdmin(conversationId: string, publicKey: string, admin: boolean) {
		return this.manageGroup(conversationId, (c, me, name) => (admin ? promoteAdmin : demoteAdmin)(c, me, publicKey, name));
	}

	renameGroup(conversationId: string, groupName: string) {
		return this.manageGroup(conversationId, (c, me, name) => renameGroup(c, me, groupName, name));
	}

	leaveGroup(conversationId: string) {
		return this.manageGroup(conversationId, (c, me, name) => leaveGroup(c, me, name));
	}

	/**
	 * Um embrulho para um membro do grupo. Se a busca de onde ele recebe falhar (rede ruim),
	 * vai para a lista padrão, que quase todo mundo usa, em vez de não ir: um aviso de grupo
	 * perdido deixa o grupo diferente no celular dele.
	 */
	private async enqueueTo(recipient: string, wrap: Parameters<SyncEngine['enqueue']>[0], messageId?: string) {
		await this.requireNetwork().engine.enqueue(wrap, await this.relaysOrDefault(recipient), messageId);
	}

	/** Onde o contato recebe; sem saber, os relays padrão. */
	private relaysOrDefault(recipient: string) {
		return this.deliveryRelays(recipient).catch(async () => (await relayList()).dm);
	}

	private requireNetwork() {
		if (!this.network) throw new Error('Sem conexão com a rede');
		return this.network;
	}

	/**
	 * Envia para uma conversa: ao contato (1:1) ou a cada membro do grupo, com a tag `g`.
	 * A mensagem aparece na hora como "enviando" (RNF-12) e segue pela fila; sem internet,
	 * sai quando a conexão voltar. `store: false` para o que não vira mensagem (pedido de apagar).
	 */
	private sendTo(conversationId: string, content: string, tags: string[][], kind: MessageKind, store = true) {
		// Em fila: o horário de cada mensagem sai depois da anterior (sendTime), e a primeira para
		// alguém espera a busca dos relays dele; sem a fila, a segunda pegava o mesmo segundo e
		// chegava trocada (2026-10-22).
		const run = this.sending.then(() => this.sendNow(conversationId, content, tags, kind, store));
		this.sending = run.catch(() => {});
		return run;
	}

	private async sendNow(conversationId: string, content: string, tags: string[][], kind: MessageKind, store: boolean) {
		const network = this.requireNetwork();
		if (conversationId.startsWith('grupo:')) {
			const conversation = await storage.conversations.get(conversationId);
			if (!conversation?.group?.amMember) throw new NotInGroupError();
			const groupTag = ['g', conversationId.slice('grupo:'.length)];
			const nameTags = kind !== 14 && kind !== 15 ? [] : await nameTagFor(storage, conversationId, this.current.displayName);
			const wrapped = await vault.wrapGroupMessage(
				conversation.members,
				content,
				[...nameTags, ...tags, groupTag],
				kind,
				sendTime(conversation)
			);
			if (store) {
				await storeOutgoing(storage, wrapped.rumor);
				this.version++;
			}
			for (const { recipient, wrap } of wrapped.toRecipients) void this.enqueueTo(recipient, wrap, store ? wrapped.rumor.id : undefined);
			void network.engine.enqueue(wrapped.toSelf, await this.myDmRelays());
			if (store) void this.sendProfile(conversation.members);
			return wrapped.rumor;
		}
		const recipient = conversationId.slice('direta:'.length);
		const nameTags = kind !== 14 && kind !== 15 ? [] : await nameTagFor(storage, recipient, this.current.displayName);
		const wrapped = await vault.wrapDirectMessage(
			recipient,
			content,
			[...nameTags, ...tags],
			kind,
			sendTime(await storage.conversations.get(conversationId))
		);
		// guarda antes de buscar onde o contato recebe: com relays fora do ar a busca leva até ~10 s e, sem isto, a
		// mensagem não aparecia nem ficava na fila (RNF-12)
		if (store) {
			await storeOutgoing(storage, wrapped.rumor, recipient);
			this.version++;
		}
		let relays: string[];
		try {
			relays = await this.deliveryRelays(recipient);
		} catch (err) {
			// sem para onde enviar: não deixa uma "pendente" eterna, o texto volta para o campo
			if (store) {
				await deleteForMe(storage, wrapped.rumor.id);
				this.version++;
			}
			throw err;
		}
		// a fila guarda e tenta de novo sozinha: a tela não espera a rede
		void network.engine.enqueue(wrapped.toRecipient, relays, store ? wrapped.rumor.id : undefined);
		void network.engine.enqueue(wrapped.toSelf, await this.myDmRelays());
		if (store) void this.sendProfile([recipient]);
		return wrapped.rumor;
	}

	/** Envia texto para uma conversa (1:1 ou grupo), respondendo a uma mensagem dela se `replyTo` vier (RF-22). */
	sendText(conversationId: string, text: string, replyTo?: string) {
		return this.sendTo(conversationId, text.trim(), replyTo ? replyTags(replyTo) : [], 14);
	}

	/**
	 * Reage a uma mensagem com um emoji (RF-23); o mesmo emoji de novo desfaz. Uma reação por pessoa: trocar de emoji
	 * substitui a anterior em todos os aparelhos. Aparece na hora, antes de a rede confirmar.
	 */
	async react(conversationId: string, messageId: string, emoji: string) {
		const message = await storage.messages.get(messageId);
		if (!message || message.deleted || message.notice || message.upload || message.conversationId !== conversationId) return;
		const me = this.current.publicKey;
		const [current] = await storage.reactions.listBySender(messageId, me);
		if (current?.emoji === emoji) {
			await storage.reactions.delete(current.id);
			this.version++;
			// desfazer é um pedido de apagar a reação (NIP-25 e NIP-09)
			await this.sendTo(conversationId, '', [['e', current.id], ['k', String(REACTION_KIND)]], 5, false);
			return;
		}
		const rumor = await this.sendTo(conversationId, emoji, reactionTags(message), REACTION_KIND, false);
		if (rumor && (await storeReaction(storage, me, rumor))) this.version++;
	}

	/** Favoritar ou tirar dos favoritos (RF-28): só neste aparelho. */
	async setStarred(messageIds: string[], starred: boolean) {
		await setStarred(storage, messageIds, starred);
		this.version++;
	}

	/**
	 * As favoritas, mais recentes primeiro: de todas as conversas ou só de `conversationId`. Cada uma vem com o nome
	 * da conversa, de quem escreveu e o endereço da tela dela.
	 */
	async listStarred(conversationId?: string): Promise<Array<{ message: MessageRecord; title: string; author: string; direct: boolean; key: string }>> {
		const out = [];
		const names = new Map<string, (publicKey: string) => string>();
		for (const message of await storage.messages.listStarred()) {
			if (conversationId && message.conversationId !== conversationId) continue;
			const conversation = await storage.conversations.get(message.conversationId);
			if (!conversation) continue;
			if (conversation.group) {
				if (!names.has(conversation.id)) {
					const nameOf = await this.groupNames(conversation);
					names.set(conversation.id, (key) => memberName(nameOf(key)));
				}
				const author = names.get(conversation.id)!(message.sender);
				out.push({ message, title: conversation.group.state.name, author, direct: false, key: conversation.id.slice('grupo:'.length) });
			} else {
				const key = conversation.members[0];
				const contact = await storage.contacts.get(key);
				const title = contact ? contactName(contact) : `${toNpub(key).slice(0, 12)}…`;
				out.push({ message, title, author: message.sender === this.current.publicKey ? m.citada_voce() : title, direct: true, key });
			}
		}
		return out;
	}

	getReactions(conversationId: string): Promise<ReactionRecord[]> {
		return storage.reactions.listByConversation(conversationId);
	}

	getMessage(messageId: string) {
		return storage.messages.get(messageId);
	}

	/**
	 * Encaminha uma mensagem a outra conversa (RF-28, RF-70): o texto, ou a mesma referência do arquivo, sem baixar
	 * nem subir de novo. Não encaminha o que ainda não saiu, o que foi apagado nem avisos.
	 */
	async forwardMessage(messageId: string, conversationId: string) {
		const message = await storage.messages.get(messageId);
		const forward = message && forwardOf(message);
		if (!forward) throw new Error('Esta mensagem não pode ser encaminhada.');
		if (conversationId.startsWith('grupo:') && !(await storage.conversations.get(conversationId))?.group?.amMember) {
			throw new NotInGroupError();
		}
		await this.sendTo(conversationId, forward.content, forward.tags, forward.kind);
	}

	/** Para onde dá para encaminhar: contatos e grupos de que faço parte. */
	async listForwardTargets(): Promise<Array<{ id: string; name: string; key: string; group: boolean }>> {
		const contacts = (await this.listContacts()).map((c) => ({
			id: directConversationId(c.publicKey),
			name: contactName(c),
			key: c.publicKey,
			group: false
		}));
		const groups = (await this.listConversations())
			.filter((c) => c.group?.amMember)
			.map((c) => ({ id: c.id, name: c.group!.state.name, key: c.id.slice('grupo:'.length), group: true }));
		return [...groups, ...contacts];
	}

	/**
	 * Envia um áudio: o balão aparece na hora, tocável, com o relógio de "enviando"; cifrar, subir para os
	 * Blossom (o mesmo arquivo não sobe duas vezes) e mandar a mensagem kind 15 pela fila acontece por trás,
	 * com novas tentativas por alguns minutos (core/media/pending-upload.ts). No grupo, o arquivo sobe uma vez
	 * só; só a mensagem com o endereço vai para cada um.
	 */
	async sendAudio(conversationId: string, file: Blob, duration: number, start = 0) {
		if (conversationId.startsWith('grupo:') && !(await storage.conversations.get(conversationId))?.group?.amMember) {
			throw new NotInGroupError();
		}
		const message = await startPendingAudio(storage, { conversationId, me: this.current.publicKey, file, duration, start });
		this.version++;
		void this.runUpload(message.id);
	}

	/** Envia uma foto da galeria: comprime, mostra o balão na hora e sobe por trás, como o áudio (RF-41). */
	async sendPhoto(conversationId: string, original: Blob) {
		if (conversationId.startsWith('grupo:') && !(await storage.conversations.get(conversationId))?.group?.amMember) {
			throw new NotInGroupError();
		}
		const { file, width, height, thumb } = await prepareFromFile(original);
		const message = await startPendingPhoto(storage, { conversationId, me: this.current.publicKey, file, width, height, thumb });
		this.version++;
		void this.runUpload(message.id);
	}

	/** Uma tentativa de envio do áudio; se falhar, a próxima fica marcada com espera crescente. */
	private async runUpload(id: string) {
		if (this.uploading.has(id)) return;
		this.uploading.add(id);
		clearTimeout(this.uploadTimers.get(id));
		this.uploadTimers.delete(id);
		try {
			const list = await relayList();
			const conversationId = (await storage.messages.get(id))?.conversationId;
			const result = await tryPendingUpload(storage, id, {
				servers: [...list.blossom, ...list.blossomReserva],
				signer: (template) => vault.sign(template),
				send: async (media) => void (await this.sendTo(conversationId!, media.urls[0], mediaTags(media as MessageMedia), 15))
			});
			if (result.state === 'depois') {
				this.uploadTimers.set(
					id,
					setTimeout(() => void this.runUpload(id), Math.max(0, result.at - Date.now()))
				);
			}
		} finally {
			this.uploading.delete(id);
			this.version++;
		}
	}

	/** Voltou para a tela ou a rede: o que estava esperando a próxima tentativa tenta já. */
	private async resumeUploads() {
		for (const id of await listPendingUploads(storage)) void this.runUpload(id);
	}

	/** "Tentar de novo" num áudio que não saiu. */
	async retryUpload(messageId: string) {
		if (await retryPendingUpload(storage, messageId)) {
			this.version++;
			void this.runUpload(messageId);
		}
	}

	/** "Apagar" num áudio que não saiu (ou cancelar o que ainda sobe). */
	async discardUpload(messageId: string) {
		clearTimeout(this.uploadTimers.get(messageId));
		this.uploadTimers.delete(messageId);
		await discardPendingUpload(storage, messageId);
		this.version++;
	}

	/** Apagar para mim (RF-25): some deste aparelho, sem avisar ninguém. */
	async deleteForMe(messageId: string) {
		if ((await storage.messages.get(messageId))?.upload) return this.discardUpload(messageId);
		await deleteForMe(storage, messageId);
		this.version++;
	}

	/** Excluir conversa: some deste aparelho, sem avisar ninguém; o contato fica. Mensagem nova recomeça a conversa. */
	async deleteConversation(conversationId: string) {
		await deleteConversation(storage, conversationId, (id) => this.discardUpload(id));
		this.version++;
	}

	/**
	 * Apagar para todos (RF-25): troca pelo aviso aqui, manda o pedido cifrado a quem está
	 * na conversa e aos meus outros aparelhos e, se ninguém mais usa o arquivo, tira dos
	 * servidores. É um pedido: o Lero-lero dos outros apaga, mas apps de terceiros podem ignorar.
	 */
	async deleteForEveryone(conversationId: string, messageId: string) {
		const message = await storage.messages.get(messageId);
		if (!message || message.deleted || message.notice || message.sender !== this.current.publicKey) return;
		// ainda não saiu: ninguém recebeu nada para apagar
		if (message.upload) return this.discardUpload(messageId);
		await markDeleted(storage, message);
		this.version++;
		await this.sendTo(conversationId, '', deletionTags(message), 5, false);
		// arquivo que nenhuma outra mensagem usa (markDeleted já tirou do aparelho): sai dos servidores
		const media = message.media;
		if (media && !(await storage.media.get(media.ox))) {
			void removeFromBlossom(media.urls, media.x, (template) => vault.sign(template)).catch(() => {});
		}
	}

	/** O arquivo, se já está no aparelho (foto baixada antes, ou que eu mesmo enviei); sem rede e sem baixar. */
	async downloadedMedia(ox: string): Promise<Blob | undefined> {
		return (await storage.media.get(ox))?.file;
	}

	/** Arquivo de uma mensagem: do aparelho, ou baixado, conferido e decifrado na hora. */
	openMedia(media: MessageMedia): Promise<Blob> {
		return openMedia(storage, media);
	}

	/**
	 * Onde o contato recebe: o que veio no convite; senão o kind 10050 dele na rede;
	 * senão a lista padrão, que quase todo mundo usa (o convite curto não traz relays).
	 * A reserva não é guardada no contato, para a busca ser tentada de novo da próxima vez.
	 */
	private async deliveryRelays(publicKey: string): Promise<string[]> {
		const contact = await storage.contacts.get(publicKey);
		if (contact?.dmRelays.length) return contact.dmRelays;
		// membro de grupo que não é contato: os relays que vieram no cartão dele
		const card = await storage.profiles.get(publicKey);
		if (card?.relays.length) return card.relays;
		const cached = this.foundRelays.get(publicKey);
		if (cached) return cached;
		const list = await relayList();
		const found = await fetchDmRelays(this.network!.pool, list.geral, publicKey);
		if (found.length) {
			if (contact) await storage.contacts.put({ ...contact, dmRelays: found });
			// membro de grupo que não é contato: lembra nesta sessão, para não buscar a cada mensagem
			else this.foundRelays.set(publicKey, found);
			return found;
		}
		if (!list.dm.length) throw new NoRelaysError();
		return list.dm;
	}

	/**
	 * Conversa aberta na tela: conecta já aos relays de quem vai receber e mantém enquanto
	 * ela estiver aberta, para a primeira mensagem sair em ~200 ms em vez de ~1,5 s.
	 * Devolve a função que libera ao sair da conversa.
	 */
	async prepareConversation(conversationId: string): Promise<() => void> {
		const network = this.network;
		if (!network) return () => {};
		const conversation = await storage.conversations.get(conversationId);
		const people = conversation?.members ?? [conversationId.slice('direta:'.length)];
		const found = await Promise.allSettled(people.map((p) => this.deliveryRelays(p)));
		const relays = [...new Set(found.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])))];
		return network.pool.hold(relays).release;
	}

	/**
	 * Comentário de teste: vai como mensagem cifrada para a conta de comentários,
	 * que entra nos contatos com um nome fixo para a resposta aparecer na conversa.
	 */
	async sendFeedback(invite: string, contactName: string, text: string): Promise<string> {
		const recipient = parseInvite(invite);
		const existing = await storage.contacts.get(recipient.publicKey);
		if (existing?.state !== 'aceito') await this.addContact(recipient, contactName);
		await this.sendText(directConversationId(recipient.publicKey), text);
		return recipient.publicKey;
	}

	listConversations(): Promise<ConversationRecord[]> {
		return storage.conversations.listByRecent();
	}

	getConversation(conversationId: string) {
		return storage.conversations.get(conversationId);
	}

	getMessages(conversationId: string, limit: number, before?: number): Promise<MessageRecord[]> {
		return storage.messages.listByConversation(conversationId, limit, before);
	}

	async markRead(conversationId: string) {
		await markRead(storage, conversationId);
		this.version++;
	}

	/** Como chamar cada membro de um grupo nesta tela ("Você", contato, "~Nome"). */
	groupNames(conversation: ConversationRecord) {
		return groupNames(storage, conversation.group!, this.current.publicKey);
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

	async addContact(invite: Invite, localName?: string): Promise<ContactRecord> {
		const contact = await addContact(storage.contacts, invite, { myPublicKey: this.current.publicKey, localName });
		await this.refreshPhoto(contact.publicKey);
		return contact;
	}

	getContact(publicKey: string) {
		return storage.contacts.get(publicKey);
	}

	listContacts() {
		return listContacts(storage.contacts);
	}

	/** Pedidos de mensagem (RF-12): quem escreveu sem ser contato, com a conversa. */
	listRequests() {
		return listRequests(storage);
	}

	listBlocked() {
		return listBlocked(storage);
	}

	/** Grupos em que alguém que não é contato me pôs (RF-12). */
	listGroupRequests() {
		return listGroupRequests(storage);
	}

	/** Aceitar o grupo: passa à lista e só agora me apresento aos membros. */
	async acceptGroupRequest(conversationId: string) {
		const accepted = await acceptGroupRequest(storage, conversationId);
		if (accepted) await this.afterGroupChange({ conversation: accepted, isNew: true, joined: true, newMembers: [] });
		this.version++;
	}

	/** Bloquear o grupo (RF-13): bloqueia quem me adicionou e descarta o grupo daqui, sem aviso a ninguém. */
	async blockGroupRequest(conversationId: string) {
		await blockGroupRequest(storage, conversationId, (id) => this.discardUpload(id));
		this.version++;
	}

	async acceptRequest(publicKey: string) {
		await acceptRequest(storage, publicKey);
		this.version++;
		// aceito: a foto do cartão, que ficou guardada, passa a aparecer (T9)
		await this.refreshPhoto(publicKey);
	}

	/** Bloquear (RF-13): a conversa some daqui e o que vier dessa chave é descartado. */
	async blockContact(publicKey: string) {
		await blockContact(storage, publicKey, (id) => this.discardUpload(id));
		this.version++;
		await this.refreshPhoto(publicKey);
	}

	async unblockContact(publicKey: string) {
		await unblockContact(storage, publicKey);
		this.version++;
		await this.refreshPhoto(publicKey);
	}

	renameContact(publicKey: string, localName: string) {
		return renameContact(storage.contacts, publicKey, localName);
	}

	// ---------- cartão de perfil (Q-P5, RF-02) ----------

	/**
	 * O meu cartão. Quem usava o app antes dele não tem um guardado: nasce do nome e dos relays. Mudou a versão do
	 * app, ganha um horário novo e sai de novo para cada um junto da próxima mensagem (só a versão, sem pressa).
	 */
	async myProfile(): Promise<ProfileRecord> {
		const me = this.current.publicKey;
		const saved = await storage.profiles.get(me);
		const fields = { name: this.current.displayName, relays: await this.myDmRelays(), app: __APP_RELEASE__, features: PROFILE_FEATURES };
		const same =
			saved &&
			saved.name === fields.name &&
			saved.app === fields.app &&
			saved.relays.join(' ') === fields.relays.join(' ') &&
			saved.features.join(' ') === fields.features.join(' ');
		if (same) return saved;
		const card: ProfileRecord = { ...saved, ...fields, publicKey: me, updatedAt: nextVersion(saved) };
		await storage.profiles.put(card);
		return card;
	}

	/** Manda o meu cartão a quem ainda não tem a versão atual (cada um no seu embrulho: ninguém vê a lista). */
	private async sendProfile(recipients: string[]) {
		try {
			if (!this.network || !recipients.length) return;
			const card = await this.myProfile();
			const due = await profileDue(storage, recipients, card.updatedAt);
			if (!due.length) return;
			const { content, tags } = profileEvent(card);
			for (const recipient of due) {
				const wrapped = await vault.wrapDirectMessage(recipient, content, tags, PROFILE_KIND, card.updatedAt);
				await this.enqueueTo(recipient, wrapped.toRecipient);
			}
			await markProfileSent(storage, due, card.updatedAt);
		} catch {
			// sem rede: o cartão vai junto da próxima mensagem
		}
	}

	/**
	 * Muda meu nome e a foto (`null` tira a foto; sem o campo, fica a atual) e manda o cartão novo a todos com
	 * quem já falei. A foto nova sobe antes, cifrada, para os Blossom; sem rede, nada muda e a tela avisa.
	 */
	async updateProfile(name: string, photo?: Blob | null) {
		const clean = cleanName(name);
		if (!clean) throw new Error('nome vazio');
		const me = this.current.publicKey;
		const card = await this.myProfile();
		const old = card.photo;
		let next = photo === null ? undefined : old;
		if (photo) {
			const { file, width, height, thumb } = await prepareProfileFromFile(photo);
			const list = await relayList();
			const ref = await prepareMedia(storage, file, {
				servers: [...list.blossom, ...list.blossomReserva],
				signer: (template) => vault.sign(template)
			});
			const record = await storage.media.get(ref.ox);
			if (record) await storage.media.put({ ...record, keep: true });
			next = { ...ref, width, height, thumb };
		}
		await this.save({ ...this.current, displayName: clean });
		await storage.profiles.put({ ...card, name: clean, photo: next, updatedAt: nextVersion(card) });
		// a foto antiga sai daqui e dos servidores (quem ainda não baixou fica com a prévia)
		if (old && old.ox !== next?.ox) {
			if ((await storage.messages.countUsingMedia(old.ox)) === 0) await storage.media.delete(old.ox);
			void removeFromBlossom(old.urls, old.x, (template) => vault.sign(template)).catch(() => {});
		}
		this.version++;
		await this.refreshPhoto(me);
		void this.sendProfile(await profileAudience(storage, me));
	}

	/** O cartão que a pessoa mandou, se chegou algum. */
	getProfile(publicKey: string) {
		return storage.profiles.get(publicKey);
	}

	private async refreshPhotos() {
		for (const card of await storage.profiles.list()) await this.refreshPhoto(card.publicKey);
	}

	/** Atualiza a foto de uma pessoa no Avatar; baixa a foto inteira na primeira vez (a prévia aparece antes). */
	private async refreshPhoto(publicKey: string) {
		if (!this.identity) return;
		const photo = (await storage.profiles.get(publicKey))?.photo;
		const allowed = photo && (await photoAllowed(storage, this.current.publicKey, publicKey));
		const file = allowed ? (await storage.media.get(photo.ox))?.file : undefined;
		const old = this.photoUrls.get(publicKey);
		if (old) URL.revokeObjectURL(old);
		this.photoUrls.delete(publicKey);
		if (!allowed) {
			delete this.photos[publicKey];
			return;
		}
		if (file) {
			const url = URL.createObjectURL(file);
			this.photoUrls.set(publicKey, url);
			this.photos[publicKey] = url;
			return;
		}
		if (photo.thumb) this.photos[publicKey] = `data:image/jpeg;base64,${photo.thumb}`;
		if (this.downloadingPhotos.has(photo.ox)) return;
		this.downloadingPhotos.add(photo.ox);
		try {
			await openMedia(storage, photo);
			// a foto de perfil não expira do aparelho (RF-72): é o que aparece em todo lugar
			const record = await storage.media.get(photo.ox);
			if (record) await storage.media.put({ ...record, keep: true });
			await this.refreshPhoto(publicKey);
		} catch {
			// sem rede ou o servidor apagou: fica a prévia; tenta de novo na próxima abertura
		} finally {
			this.downloadingPhotos.delete(photo.ox);
		}
	}

	private clearPhotos() {
		for (const url of this.photoUrls.values()) URL.revokeObjectURL(url);
		this.photoUrls.clear();
		this.photos = {};
	}

	getSetting<T>(key: string) {
		return storage.settings.get<T>(key);
	}

	setSetting(key: string, value: unknown) {
		return storage.settings.set(key, value);
	}
}

export const session = new Session();

/** Horário de uma versão nova do meu cartão, em segundos: sempre depois da anterior. */
const nextVersion = (card?: ProfileRecord) => Math.max(Math.floor(Date.now() / 1000), (card?.updatedAt ?? 0) + 1);

const relaysOf = (tags: string[][]) => tags.filter((t) => t[0] === 'relay').map((t) => t[1]);
