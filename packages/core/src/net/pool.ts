// Pool de relays (docs/05: "Pool de relays"): mantém as conexões vivas, reconecta com
// espera crescente e refaz as assinaturas a cada reconexão. Nenhum relay sozinho é
// essencial: se um cair, os outros seguem (RNF-35).

import type { NostrEvent } from 'nostr-tools/pure';
import type { Filter } from 'nostr-tools/filter';
import { RelayConnection, type PublishResult, type Signer, type SocketFactory, type SubscriptionHandlers } from './connection.ts';

/** Espera entre tentativas de reconexão; a última se repete. */
export const RECONNECT_DELAYS_MS = [1_000, 3_000, 10_000, 30_000, 60_000];

/**
 * Conexão sem assinatura ativa (usada só para publicar ou consultar) fecha depois
 * deste tempo parada: não há por que manter os relays gerais abertos (bateria, RNF-25).
 */
export const IDLE_CLOSE_MS = 60_000;

type PoolSubscription = {
	/** recalculado a cada (re)conexão: o motor de sincronização usa o cursor mais recente */
	filters: () => Filter[];
	handlers: SubscriptionHandlers;
	active?: { close: () => void };
};

type ManagedRelay = {
	url: string;
	conn: RelayConnection;
	subs: Set<PoolSubscription>;
	attempt: number;
	connecting: boolean;
	timer?: ReturnType<typeof setTimeout>;
	idleTimer?: ReturnType<typeof setTimeout>;
	waiters: Array<(ok: boolean) => void>;
};

export type PoolOptions = {
	signer: Signer;
	socket?: SocketFactory;
	timeoutMs?: number;
	reconnectDelaysMs?: number[];
	idleCloseMs?: number;
};

export class RelayPool {
	private relays = new Map<string, ManagedRelay>();
	private closed = false;
	private readonly options: PoolOptions;

	constructor(options: PoolOptions) {
		this.options = options;
	}

	/** Assina nos relays indicados e mantém a assinatura através de quedas e reconexões. */
	subscribe(
		urls: string[],
		filters: (url: string) => Filter[],
		handlers: (url: string) => SubscriptionHandlers
	): { close: () => void } {
		const created: Array<[ManagedRelay, PoolSubscription]> = [];
		for (const url of urls) {
			const relay = this.relay(url);
			const sub: PoolSubscription = { filters: () => filters(url), handlers: handlers(url) };
			relay.subs.add(sub);
			clearTimeout(relay.idleTimer);
			created.push([relay, sub]);
			if (relay.conn.connected) this.activate(relay, sub);
		}
		return {
			close: () => {
				for (const [relay, sub] of created) {
					relay.subs.delete(sub);
					sub.active?.close();
					this.closeWhenIdle(relay);
				}
			}
		};
	}

	/**
	 * Publica em vários relays ao mesmo tempo; devolve o resultado de cada um (nunca rejeita).
	 * `onResult` avisa cada relay assim que ele responde, sem esperar o mais lento.
	 */
	async publish(
		urls: string[],
		event: NostrEvent,
		onResult?: (url: string, result: PublishResult) => void
	): Promise<Record<string, PublishResult>> {
		const results = await Promise.all(
			urls.map(async (url): Promise<[string, PublishResult]> => {
				let result: PublishResult;
				try {
					const conn = await this.ready(url);
					result = await conn.publish(event);
				} catch (err) {
					result = { ok: false, message: err instanceof Error ? err.message : String(err) };
				}
				try {
					onResult?.(url, result);
					return [url, result];
				} finally {
					this.closeWhenIdle(this.relays.get(url));
				}
			})
		);
		return Object.fromEntries(results);
	}

	/** Consulta pontual: junta o que os relays têm até o fim do histórico (EOSE) de cada um. */
	async query(urls: string[], filters: Filter[]): Promise<NostrEvent[]> {
		const found = new Map<string, NostrEvent>();
		await Promise.all(
			urls.map(async (url) => {
				try {
					const conn = await this.ready(url);
					await new Promise<void>((resolve) => {
						const timer = setTimeout(done, this.options.timeoutMs ?? 10_000);
						const sub = conn.subscribe(filters, {
							onevent: (e) => found.set(e.id, e),
							oneose: done,
							onclosed: done
						});
						function done() {
							clearTimeout(timer);
							sub.close();
							resolve();
						}
					});
				} catch {
					// relay fora do ar: os outros respondem
				} finally {
					this.closeWhenIdle(this.relays.get(url));
				}
			})
		);
		return [...found.values()];
	}

	/**
	 * Abre e mantém conexões antes de precisar delas (ex.: ao abrir uma conversa, os relays
	 * do contato): a primeira mensagem não paga conexão + TLS + autenticação (~1,5 s).
	 * Conta como assinatura para o fechamento por inatividade até `release` ser chamado.
	 */
	hold(urls: string[]): { release: () => void } {
		const held: Array<[ManagedRelay, PoolSubscription]> = [];
		for (const url of urls) {
			const relay = this.relay(url);
			// marcador sem filtros: não assina nada, só segura a conexão aberta
			const marker: PoolSubscription = { filters: () => [], handlers: { onevent: () => {} } };
			relay.subs.add(marker);
			clearTimeout(relay.idleTimer);
			held.push([relay, marker]);
		}
		return {
			release: () => {
				for (const [relay, marker] of held) {
					relay.subs.delete(marker);
					this.closeWhenIdle(relay);
				}
			}
		};
	}

	/** Volta a conectar já, sem esperar o próximo intervalo (ex.: o app voltou para a tela, RF-80). */
	reconnectNow() {
		for (const relay of this.relays.values()) {
			if (relay.conn.connected || relay.connecting) continue;
			clearTimeout(relay.timer);
			relay.attempt = 0;
			void this.connect(relay);
		}
	}

	/** Relays conectados agora (para a interface mostrar o estado da rede). */
	connectedUrls(): string[] {
		return [...this.relays.entries()].filter(([, r]) => r.conn.connected).map(([url]) => url);
	}

	close() {
		this.closed = true;
		for (const relay of this.relays.values()) {
			clearTimeout(relay.timer);
			clearTimeout(relay.idleTimer);
			relay.conn.onclose = undefined;
			relay.conn.close();
			relay.waiters.splice(0).forEach((w) => w(false));
		}
		this.relays.clear();
	}

	private relay(url: string): ManagedRelay {
		let relay = this.relays.get(url);
		if (!relay) {
			const conn = new RelayConnection(url, this.options);
			relay = { url, conn, subs: new Set(), attempt: 0, connecting: false, waiters: [] };
			this.relays.set(url, relay);
			const r = relay;
			conn.onclose = () => {
				for (const sub of r.subs) sub.active = undefined;
				this.scheduleReconnect(r);
			};
			void this.connect(relay);
		}
		return relay;
	}

	/** Agenda o fechamento de uma conexão sem assinaturas; usar de novo antes disso cancela. */
	private closeWhenIdle(relay: ManagedRelay | undefined) {
		if (!relay || relay.subs.size > 0) return;
		clearTimeout(relay.idleTimer);
		relay.idleTimer = setTimeout(() => {
			if (relay.subs.size > 0 || this.relays.get(relay.url) !== relay) return;
			clearTimeout(relay.timer);
			relay.conn.onclose = undefined;
			relay.conn.close();
			this.relays.delete(relay.url);
		}, this.options.idleCloseMs ?? IDLE_CLOSE_MS);
	}

	private async connect(relay: ManagedRelay) {
		if (this.closed || relay.connecting) return;
		relay.connecting = true;
		try {
			await relay.conn.connect();
			relay.attempt = 0;
			for (const sub of relay.subs) this.activate(relay, sub);
			relay.waiters.splice(0).forEach((w) => w(true));
		} catch {
			relay.waiters.splice(0).forEach((w) => w(false));
			this.scheduleReconnect(relay);
		} finally {
			relay.connecting = false;
		}
	}

	private scheduleReconnect(relay: ManagedRelay) {
		if (this.closed || relay.connecting) return;
		const delays = this.options.reconnectDelaysMs ?? RECONNECT_DELAYS_MS;
		const delay = delays[Math.min(relay.attempt, delays.length - 1)];
		relay.attempt++;
		clearTimeout(relay.timer);
		relay.timer = setTimeout(() => void this.connect(relay), delay);
	}

	private activate(relay: ManagedRelay, sub: PoolSubscription) {
		sub.active?.close();
		const filters = sub.filters();
		if (filters.length === 0) return; // marcador de hold(): nada a assinar
		try {
			sub.active = relay.conn.subscribe(filters, sub.handlers);
		} catch {
			sub.active = undefined; // caiu no meio: a reconexão tenta de novo
		}
	}

	/** Espera a conexão ficar pronta (ou a primeira tentativa falhar). */
	private ready(url: string): Promise<RelayConnection> {
		const relay = this.relay(url);
		clearTimeout(relay.idleTimer);
		if (relay.conn.connected) return Promise.resolve(relay.conn);
		if (!relay.connecting) {
			clearTimeout(relay.timer);
			void this.connect(relay);
		}
		return new Promise((resolve, reject) => {
			relay.waiters.push((ok) => (ok ? resolve(relay.conn) : reject(new Error(`sem conexão com ${url}`))));
		});
	}
}
