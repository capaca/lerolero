// Estado da sessão: se há identidade no aparelho e se ela está desbloqueada.
// As telas chamam estas funções; a chave privada fica no worker, nunca aqui.

import {
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
	deleteForMe,
	deletionTags,
	parseInvite,
	directConversationId,
	groupConversationId,
	dmRelayListTemplate,
	fetchDmRelays,
	markDeleted,
	markRead,
	markSent,
	mediaTags,
	nameTagFor,
	openMedia,
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
import { relayList } from './relays.ts';

export type Status = 'carregando' | 'sem-identidade' | 'bloqueado' | 'desbloqueado';

const ATTEMPTS_KEY = 'tentativasPin';
const OPEN_SESSION_KEY = 'sessaoAberta';

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
	/** onde recebem as pessoas que não são contatos (membros de grupo), achado nesta sessão */
	private foundRelays = new Map<string, string[]>();
	/** gravação da sessão aberta em andamento: bloquear espera, senão ela voltaria depois de apagada */
	private savingSession?: Promise<void>;
	/** fila de envios (sendTo) */
	private sending: Promise<void> = Promise.resolve();
	/** áudios subindo agora e o aviso da próxima tentativa de cada um que falhou */
	private uploading = new Set<string>();
	private uploadTimers = new Map<string, ReturnType<typeof setTimeout>>();

	async init() {
		this.identity = await storage.identity.get();
		if (!this.identity) this.status = 'sem-identidade';
		else if (await this.resumeOpenSession()) this.unlocked();
		else this.status = 'bloqueado';
	}

	/** Desbloqueado: entra e conecta. Também guarda a sessão, para recarregar sem pedir o PIN. */
	private unlocked() {
		this.status = 'desbloqueado';
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
		void requestPersistence();
		return words;
	}

	async restore(phraseInput: string, pin: string, displayName: string) {
		const { publicKey, phrase } = await vault.restore(phraseInput, pin);
		// quem restaurou digitou a frase: está provado que ela foi guardada
		await this.save({ id: 'eu', publicKey, phrase, phraseConfirmed: true, displayName, createdAt: Date.now() });
		this.unlocked();
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
		this.unlocked();
	}

	async lock() {
		this.stopNetwork();
		await this.savingSession;
		await storage.settings.set(OPEN_SESSION_KEY, undefined);
		await vault.lock();
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
		await this.publishDmRelays();
	}

	private stopNetwork() {
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
		const stored = await storeIncoming(storage, this.current.publicKey, rumor, { openConversationId: this.openConversationId });
		if (stored?.isNew) this.version++;
	}

	/** Aviso de grupo: atualiza o grupo, me apresento a quem entrou e repasso o que faltou (docs/06 §3.3). */
	private async receiveGroupControl(rumor: Awaited<ReturnType<Vault['unwrap']>>) {
		const me = this.current.publicKey;
		const change = await storeGroupControl(storage, me, rumor);
		if (!change?.isNew) return;
		this.version++;
		// avisos meus vindos de outro aparelho: lá já me apresentei
		if (rumor.pubkey !== me) await this.afterGroupChange(change);
	}

	private async afterGroupChange({ conversation, joined, newMembers }: StoredGroupChange) {
		if (!conversation.group?.amMember) return;
		const myName = this.current.displayName;
		if (joined) await this.sendGroupChange(introduce(conversation, myName));
		else if (newMembers.length) await this.sendGroupChange(introduce(conversation, myName, newMembers));
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
		for (const { recipient, wrap } of wrapped.toRecipients) void this.enqueueTo(recipient, wrap);
		void network.engine.enqueue(wrapped.toSelf, await this.myDmRelays());
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
		const relays = await this.deliveryRelays(recipient).catch(async () => (await relayList()).dm);
		await this.requireNetwork().engine.enqueue(wrap, relays, messageId);
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
	private sendTo(conversationId: string, content: string, tags: string[][], kind: 14 | 15 | 5, store = true) {
		// Em fila: o horário de cada mensagem sai depois da anterior (sendTime), e a primeira para
		// alguém espera a busca dos relays dele; sem a fila, a segunda pegava o mesmo segundo e
		// chegava trocada (2026-10-22).
		const run = this.sending.then(() => this.sendNow(conversationId, content, tags, kind, store));
		this.sending = run.catch(() => {});
		return run;
	}

	private async sendNow(conversationId: string, content: string, tags: string[][], kind: 14 | 15 | 5, store: boolean) {
		const network = this.requireNetwork();
		if (conversationId.startsWith('grupo:')) {
			const conversation = await storage.conversations.get(conversationId);
			if (!conversation?.group?.amMember) throw new NotInGroupError();
			const groupTag = ['g', conversationId.slice('grupo:'.length)];
			const nameTags = kind === 5 ? [] : await nameTagFor(storage, conversationId, this.current.displayName);
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
			return;
		}
		const recipient = conversationId.slice('direta:'.length);
		const nameTags = kind === 5 ? [] : await nameTagFor(storage, recipient, this.current.displayName);
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
	}

	/** Envia texto para uma conversa (1:1 ou grupo). */
	sendText(conversationId: string, text: string) {
		return this.sendTo(conversationId, text.trim(), [], 14);
	}

	/**
	 * Envia um áudio: o balão aparece na hora, tocável, com o relógio de "enviando"; cifrar, subir para os
	 * Blossom (o mesmo arquivo não sobe duas vezes) e mandar a mensagem kind 15 pela fila acontece por trás,
	 * com novas tentativas por alguns minutos (core/media/pending-upload.ts). No grupo, o arquivo sobe uma vez
	 * só; só a mensagem com o endereço vai para cada um.
	 */
	async sendAudio(conversationId: string, file: Blob, duration: number) {
		if (conversationId.startsWith('grupo:') && !(await storage.conversations.get(conversationId))?.group?.amMember) {
			throw new NotInGroupError();
		}
		const message = await startPendingAudio(storage, { conversationId, me: this.current.publicKey, file, duration });
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
				send: (media) => this.sendTo(conversationId!, media.urls[0], mediaTags(media as MessageMedia), 15)
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

const relaysOf = (tags: string[][]) => tags.filter((t) => t[0] === 'relay').map((t) => t[1]);
