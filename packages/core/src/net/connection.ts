// Conexão com um relay (NIP-01), com autenticação NIP-42 quando o relay pede.
// Não reconecta sozinha: quem cuida disso é o pool (pool.ts).

import type { EventTemplate, NostrEvent } from 'nostr-tools/pure';
import type { Filter } from 'nostr-tools/filter';

/** Assina eventos de autenticação (kind 22242); vem do cofre, que guarda a chave. */
export type Signer = (template: EventTemplate) => Promise<NostrEvent>;

export type SocketFactory = (url: string) => WebSocket;

export type PublishResult = { ok: boolean; message: string };

export type SubscriptionHandlers = {
	onevent: (event: NostrEvent) => void;
	/** fim do histórico guardado; a partir daqui só chega o que for novo */
	oneose?: () => void;
	/** o relay encerrou a assinatura (motivo vem do relay) */
	onclosed?: (reason: string) => void;
};

export class RelayError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'RelayError';
	}
}

const isAuthRequired = (message: string) => message.includes('auth-required');

export class RelayConnection {
	readonly url: string;
	/** chamado quando o socket fecha, por qualquer motivo (o pool reconecta) */
	onclose?: () => void;

	private ws?: WebSocket;
	private challenge?: string;
	private authenticated = false;
	private authInFlight?: Promise<boolean>;
	private listeners = new Set<(msg: unknown[]) => void>();
	private subs = new Map<string, { filters: Filter[]; handlers: SubscriptionHandlers; retriedAuth: boolean }>();
	private nextSub = 0;
	private readonly signer: Signer;
	private readonly socket: SocketFactory;
	private readonly timeoutMs: number;

	constructor(url: string, options: { signer: Signer; socket?: SocketFactory; timeoutMs?: number }) {
		this.url = url;
		this.signer = options.signer;
		this.socket = options.socket ?? ((u) => new WebSocket(u));
		this.timeoutMs = options.timeoutMs ?? 10_000;
	}

	get connected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN;
	}

	connect(): Promise<void> {
		return this.withTimeout(
			new Promise<void>((resolve, reject) => {
				const ws = this.socket(this.url);
				this.ws = ws;
				ws.onopen = () => resolve();
				ws.onerror = () => reject(new RelayError('falha na conexão'));
				ws.onclose = () => {
					this.authenticated = false;
					this.challenge = undefined;
					this.onclose?.();
				};
				ws.onmessage = (e) => this.receive(String(e.data));
			}),
			'conexão'
		);
	}

	close() {
		this.subs.clear();
		this.ws?.close();
	}

	/** Assina e mantém a assinatura; se o relay exigir autenticação, autentica e tenta de novo uma vez. */
	subscribe(filters: Filter[], handlers: SubscriptionHandlers): { close: () => void } {
		const id = `s${this.nextSub++}`;
		this.subs.set(id, { filters, handlers, retriedAuth: false });
		this.send(['REQ', id, ...filters]);
		return {
			close: () => {
				if (this.subs.delete(id) && this.connected) this.send(['CLOSE', id]);
			}
		};
	}

	/** Publica e espera o OK; se o relay exigir autenticação, autentica e publica de novo. */
	async publish(event: NostrEvent): Promise<PublishResult> {
		let result = await this.publishOnce(event);
		if (!result.ok && isAuthRequired(result.message) && (await this.auth())) result = await this.publishOnce(event);
		return result;
	}

	private publishOnce(event: NostrEvent): Promise<PublishResult> {
		const done = this.waitFor(
			(msg) => (msg[0] === 'OK' && msg[1] === event.id ? { ok: Boolean(msg[2]), message: String(msg[3] ?? '') } : undefined),
			'publicação'
		);
		this.send(['EVENT', event]);
		return done;
	}

	/** Responde ao desafio AUTH (NIP-42). Várias chamadas ao mesmo tempo compartilham a mesma resposta. */
	private auth(): Promise<boolean> {
		if (this.authenticated) return Promise.resolve(true);
		this.authInFlight ??= (async () => {
			try {
				if (!this.challenge) {
					await this.waitFor((msg) => (msg[0] === 'AUTH' ? true : undefined), 'desafio AUTH').catch(() => undefined);
				}
				if (!this.challenge) return false;
				const event = await this.signer({
					kind: 22242,
					created_at: Math.floor(Date.now() / 1000),
					tags: [
						['relay', this.url],
						['challenge', this.challenge]
					],
					content: ''
				});
				const done = this.waitFor(
					(msg) => (msg[0] === 'OK' && msg[1] === event.id ? Boolean(msg[2]) : undefined),
					'autenticação'
				);
				this.send(['AUTH', event]);
				this.authenticated = await done;
				return this.authenticated;
			} catch {
				return false;
			} finally {
				this.authInFlight = undefined;
			}
		})();
		return this.authInFlight;
	}

	private receive(raw: string) {
		let msg: unknown[];
		try {
			msg = JSON.parse(raw);
		} catch {
			return;
		}
		if (!Array.isArray(msg)) return;
		const [type, subId] = msg;
		if (type === 'AUTH') {
			this.challenge = String(subId);
			this.authenticated = false;
		}
		const sub = typeof subId === 'string' ? this.subs.get(subId) : undefined;
		if (sub) {
			if (type === 'EVENT') sub.handlers.onevent(msg[2] as NostrEvent);
			else if (type === 'EOSE') sub.handlers.oneose?.();
			else if (type === 'CLOSED') void this.handleClosed(subId as string, String(msg[2] ?? ''));
		}
		for (const listener of this.listeners) listener(msg);
	}

	private async handleClosed(id: string, reason: string) {
		const sub = this.subs.get(id);
		if (!sub) return;
		if (isAuthRequired(reason) && !sub.retriedAuth && (await this.auth())) {
			sub.retriedAuth = true;
			this.send(['REQ', id, ...sub.filters]);
			return;
		}
		this.subs.delete(id);
		sub.handlers.onclosed?.(reason);
	}

	private send(msg: unknown[]) {
		if (!this.connected) throw new RelayError('não conectado');
		this.ws!.send(JSON.stringify(msg));
	}

	private waitFor<T>(match: (msg: unknown[]) => T | undefined, what: string): Promise<T> {
		let listener!: (msg: unknown[]) => void;
		return this.withTimeout(
			new Promise<T>((resolve) => {
				listener = (msg) => {
					const r = match(msg);
					if (r !== undefined) resolve(r);
				};
				this.listeners.add(listener);
			}),
			what
		).finally(() => this.listeners.delete(listener));
	}

	private withTimeout<T>(p: Promise<T>, what: string): Promise<T> {
		let timer: ReturnType<typeof setTimeout>;
		return Promise.race([
			p,
			new Promise<T>((_, reject) => {
				timer = setTimeout(() => reject(new RelayError(`${what}: tempo esgotado em ${this.url}`)), this.timeoutMs);
			})
		]).finally(() => clearTimeout(timer));
	}
}
