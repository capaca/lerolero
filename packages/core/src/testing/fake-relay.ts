// Relay Nostr em memória para testes: NIP-01 + NIP-42, e a regra dos relays de DM
// aptos (prototipos/relays): gift wraps só são entregues a quem se autenticou como
// o destinatário.

import { WebSocketServer, type WebSocket } from 'ws';
import { verifyEvent, type NostrEvent } from 'nostr-tools/pure';
import { matchFilters, type Filter } from 'nostr-tools/filter';

type Client = { ws: WebSocket; challenge: string; authed?: string; subs: Map<string, Filter[]> };

export class FakeRelay {
	readonly events: NostrEvent[] = [];
	/** recusa EVENTs (simula relay que não aceita) */
	rejectWrites = false;
	/** quantas conexões já foram aceitas (para o teste saber que houve reconexão) */
	accepted = 0;
	/** não responde ao AUTH (simula conexão que cai no meio da autenticação); `pendingAuth` conta os AUTH recebidos */
	ignoreAuth = false;
	pendingAuth = 0;
	private server?: WebSocketServer;
	private clients = new Set<Client>();
	private port = 0;

	get url() {
		return `ws://127.0.0.1:${this.port}`;
	}

	async start(port = 0): Promise<this> {
		this.server = new WebSocketServer({ host: '127.0.0.1', port });
		await new Promise<void>((resolve) => this.server!.once('listening', () => resolve()));
		this.port = (this.server.address() as { port: number }).port;
		this.server.on('connection', (ws) => this.accept(ws));
		return this;
	}

	/** Derruba o servidor (relay fora do ar). `start(port)` com a mesma porta o traz de volta. */
	async stop() {
		for (const c of this.clients) c.ws.terminate();
		this.clients.clear();
		await new Promise<void>((resolve) => this.server?.close(() => resolve()));
	}

	get currentPort() {
		return this.port;
	}

	/** Derruba as conexões sem desligar o servidor (queda de rede). */
	dropConnections() {
		for (const c of this.clients) c.ws.terminate();
	}

	private accept(ws: WebSocket) {
		const client: Client = { ws, challenge: Math.random().toString(36).slice(2), subs: new Map() };
		this.clients.add(client);
		this.accepted++;
		ws.on('close', () => this.clients.delete(client));
		ws.on('message', (data) => this.handle(client, String(data)));
		this.send(client, ['AUTH', client.challenge]);
	}

	private handle(client: Client, raw: string) {
		const msg = JSON.parse(raw) as unknown[];
		const [type] = msg;
		if (type === 'AUTH') {
			if (this.ignoreAuth) return void this.pendingAuth++;
			const event = msg[1] as NostrEvent;
			const ok =
				verifyEvent(event) &&
				event.kind === 22242 &&
				event.tags.some((t) => t[0] === 'challenge' && t[1] === client.challenge) &&
				event.tags.some((t) => t[0] === 'relay');
			if (ok) client.authed = event.pubkey;
			this.send(client, ['OK', event.id, ok, ok ? '' : 'invalid: auth']);
		} else if (type === 'EVENT') {
			const event = msg[1] as NostrEvent;
			if (this.rejectWrites) return this.send(client, ['OK', event.id, false, 'blocked: testes']);
			if (!verifyEvent(event)) return this.send(client, ['OK', event.id, false, 'invalid: signature']);
			if (!this.events.some((e) => e.id === event.id)) {
				// eventos substituíveis (10000–19999): fica só o mais novo de cada autor e tipo
				if (event.kind >= 10000 && event.kind < 20000) {
					const i = this.events.findIndex((e) => e.kind === event.kind && e.pubkey === event.pubkey);
					if (i >= 0) this.events.splice(i, 1);
				}
				this.events.push(event);
				for (const c of this.clients)
					for (const [id, filters] of c.subs)
						if (matchFilters(filters, event) && this.canRead(c, event)) this.send(c, ['EVENT', id, event]);
			}
			this.send(client, ['OK', event.id, true, '']);
		} else if (type === 'REQ') {
			const [, id, ...filters] = msg as [string, string, ...Filter[]];
			const asksForWraps = filters.some((f) => !f.kinds || f.kinds.includes(1059));
			const pTags = filters.flatMap((f) => f['#p'] ?? []);
			if (asksForWraps && (!client.authed || pTags.some((p) => p !== client.authed))) {
				return this.send(client, ['CLOSED', id, 'auth-required: gift wraps só para o destinatário']);
			}
			client.subs.set(id, filters);
			const matching = this.events.filter((e) => matchFilters(filters, e) && this.canRead(client, e));
			const limit = Math.min(...filters.map((f) => f.limit ?? Infinity));
			const sorted = matching.sort((a, b) => b.created_at - a.created_at).slice(0, limit);
			for (const e of sorted) this.send(client, ['EVENT', id, e]);
			this.send(client, ['EOSE', id]);
		} else if (type === 'CLOSE') {
			client.subs.delete(msg[1] as string);
		}
	}

	private canRead(client: Client, event: NostrEvent) {
		if (event.kind !== 1059) return true;
		return event.tags.some((t) => t[0] === 'p' && t[1] === client.authed);
	}

	private send(client: Client, msg: unknown[]) {
		if (client.ws.readyState === client.ws.OPEN) client.ws.send(JSON.stringify(msg));
	}
}
