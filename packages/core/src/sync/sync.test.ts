import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket as NodeWebSocket } from 'ws';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { wrapEvent } from 'nostr-tools/nip59';
import type { KdfParams } from '../crypto/seal.ts';
import { createVault } from '../identity/vault.ts';
import { RelayConnection, type SocketFactory } from '../net/connection.ts';
import { RelayPool } from '../net/pool.ts';
import { openStorage, type Storage } from '../storage/repositories.ts';
import { FakeRelay } from '../testing/fake-relay.ts';
import { CURSOR_MARGIN_S, dmRelayListTemplate, fetchDmRelays, SyncEngine } from './engine.ts';

const FAST: KdfParams = { memoryKiB: 64, iterations: 1, parallelism: 1 };
const socket: SocketFactory = (url) => new NodeWebSocket(url) as unknown as WebSocket;
const until = async (cond: () => boolean | Promise<boolean>, ms = 3000) => {
	const end = Date.now() + ms;
	while (!(await cond())) {
		if (Date.now() > end) throw new Error('condição não aconteceu a tempo');
		await new Promise((r) => setTimeout(r, 20));
	}
};

const cleanup: Array<() => unknown> = [];
afterEach(async () => {
	for (const fn of cleanup.splice(0).reverse()) await fn();
});

let dbCount = 0;
async function person() {
	const vault = createVault({ kdf: FAST });
	const { publicKey } = await vault.create('123456');
	const storage = openStorage(`sync-${dbCount++}`);
	const pool = new RelayPool({ signer: async (t) => vault.sign(t), socket, timeoutMs: 2000, reconnectDelaysMs: [50] });
	cleanup.push(() => storage.close(), () => pool.close());
	return { vault, publicKey, storage, pool };
}

async function relay() {
	const r = await new FakeRelay().start();
	cleanup.push(() => r.stop());
	return r;
}

/** gift wrap de um desconhecido para `to`, como o NIP-17 faz */
const wrapFor = (to: string, text: string) => wrapEvent({ kind: 14, content: text, tags: [['p', to]] }, generateSecretKey(), to);

describe('conexão com relay', () => {
	it('autentica sozinha (NIP-42) quando o relay exige para ler gift wraps', async () => {
		const r = await relay();
		const me = await person();
		const wrap = wrapFor(me.publicKey, 'oi');
		r.events.push(wrap);

		const conn = new RelayConnection(r.url, { signer: async (t) => me.vault.sign(t), socket });
		cleanup.push(() => conn.close());
		await conn.connect();
		const got: string[] = [];
		conn.subscribe([{ kinds: [1059], '#p': [me.publicKey] }], { onevent: (e) => got.push(e.id) });
		await until(() => got.length === 1);
		expect(got).toEqual([wrap.id]);
	});

	it('não entrega gift wraps de outra pessoa, mesmo autenticado', async () => {
		const r = await relay();
		const me = await person();
		const other = getPublicKey(generateSecretKey());
		const conn = new RelayConnection(r.url, { signer: async (t) => me.vault.sign(t), socket });
		cleanup.push(() => conn.close());
		await conn.connect();
		let closed = '';
		conn.subscribe([{ kinds: [1059], '#p': [other] }], { onevent: () => {}, onclosed: (reason) => (closed = reason) });
		await until(() => closed !== '');
		expect(closed).toMatch(/auth-required/);
	});
});

describe('motor de sincronização', () => {
	it('recebe de vários relays e processa cada embrulho uma única vez (RNF-34)', async () => {
		const [r1, r2] = [await relay(), await relay()];
		const bob = await person();
		const received: string[] = [];
		const engine = new SyncEngine({
			storage: bob.storage,
			pool: bob.pool,
			myPublicKey: bob.publicKey,
			events: { onWrap: async (w) => void received.push(w.id) }
		});
		cleanup.push(() => engine.stop());
		await engine.start([r1.url, r2.url]);

		const alice = await person();
		const wrap = wrapFor(bob.publicKey, 'mesma mensagem nos dois relays');
		await alice.pool.publish([r1.url, r2.url], wrap);

		await until(async () => (await bob.storage.sync.getCursor(r2.url)) !== undefined && (await bob.storage.sync.getCursor(r1.url)) !== undefined);
		expect(received).toEqual([wrap.id]);
	});

	it('guarda o cursor e, ao reabrir, pede só desde o cursor menos 2 dias', async () => {
		const r = await relay();
		const bob = await person();
		const engine = new SyncEngine({ storage: bob.storage, pool: bob.pool, myPublicKey: bob.publicKey, events: { onWrap: async () => {} } });
		cleanup.push(() => engine.stop());
		await engine.start([r.url]);
		const wrap = wrapFor(bob.publicKey, 'oi');
		r.events.push(wrap);
		await (await person()).pool.publish([r.url], wrapFor(bob.publicKey, 'gatilho'));
		await until(async () => (await bob.storage.sync.getCursor(r.url)) !== undefined);
		const cursor = (await bob.storage.sync.getCursor(r.url))!;

		// a assinatura refeita depois de uma queda usa o cursor salvo
		const filters = (engine as unknown as { filterFor(u: string): { since: number } }).filterFor(r.url);
		expect(filters.since).toBe(cursor - CURSOR_MARGIN_S);
	});

	it('descarta embrulhos que não abrem sem travar os outros', async () => {
		const r = await relay();
		const bob = await person();
		const ok: string[] = [];
		const engine = new SyncEngine({
			storage: bob.storage,
			pool: bob.pool,
			myPublicKey: bob.publicKey,
			events: {
				onWrap: async (w) => {
					bob.vault.unwrap(w); // lança se não abrir
					ok.push(w.id);
				}
			}
		});
		cleanup.push(() => engine.stop());
		await engine.start([r.url]);
		const alice = await person();
		const broken = { ...wrapFor(bob.publicKey, 'x'), content: 'lixo' };
		const good = wrapFor(bob.publicKey, 'boa');
		// o "quebrado" tem a assinatura invalidada pelo conteúdo trocado: injeta direto no relay
		r.events.push(broken);
		await alice.pool.publish([r.url], good);
		await until(() => ok.includes(good.id));
		expect(await bob.storage.seenWraps.has(broken.id)).toBe(true);
		expect(ok).toEqual([good.id]);
	});

	it('volta a receber depois de uma queda de conexão', async () => {
		const r = await relay();
		const bob = await person();
		const received: string[] = [];
		const engine = new SyncEngine({ storage: bob.storage, pool: bob.pool, myPublicKey: bob.publicKey, events: { onWrap: async (w) => void received.push(w.id) } });
		cleanup.push(() => engine.stop());
		await engine.start([r.url]);
		await until(() => bob.pool.connectedUrls().length === 1);

		r.dropConnections();
		await until(() => bob.pool.connectedUrls().length === 0);
		await until(() => bob.pool.connectedUrls().length === 1);

		const wrap = wrapFor(bob.publicKey, 'depois da queda');
		await (await person()).pool.publish([r.url], wrap);
		await until(() => received.includes(wrap.id));
	});

	it('guarda na fila sem conexão e envia quando o relay volta (RNF-33)', async () => {
		const r = await relay();
		const port = r.currentPort;
		await r.stop();

		const alice = await person();
		let clock = Date.now();
		const sent: string[] = [];
		const engine = new SyncEngine({
			storage: alice.storage,
			pool: alice.pool,
			myPublicKey: alice.publicKey,
			now: () => clock,
			events: { onWrap: async () => {}, onSent: async (item) => void sent.push(item.messageId!) }
		});
		cleanup.push(() => engine.stop());
		const wrap = wrapFor(getPublicKey(generateSecretKey()), 'enviada offline');
		await engine.enqueue(wrap, [`ws://127.0.0.1:${port}`], 'msg-1');
		expect(sent).toEqual([]);
		expect(await alice.storage.outbox.due(Infinity)).toHaveLength(1);

		await r.start(port);
		clock += 60_000; // passou o tempo de espera da nova tentativa
		await engine.flush();
		expect(sent).toEqual(['msg-1']);
		expect(await alice.storage.outbox.due(Infinity)).toHaveLength(0);
		expect(r.events.map((e) => e.id)).toContain(wrap.id);
	});

	it('continua tentando os relays que recusaram, para espalhar a mensagem (RNF-30)', async () => {
		const [good, bad] = [await relay(), await relay()];
		bad.rejectWrites = true;
		const alice = await person();
		let clock = Date.now();
		const sent: string[] = [];
		const engine = new SyncEngine({
			storage: alice.storage,
			pool: alice.pool,
			myPublicKey: alice.publicKey,
			now: () => clock,
			events: { onWrap: async () => {}, onSent: async (item) => void sent.push(item.id) }
		});
		cleanup.push(() => engine.stop());
		const wrap = wrapFor(getPublicKey(generateSecretKey()), 'oi');
		await engine.enqueue(wrap, [good.url, bad.url]);
		expect(sent).toEqual([wrap.id]); // "enviada" com o primeiro aceite
		const [item] = await alice.storage.outbox.due(Infinity);
		expect(item.acceptedBy).toEqual([good.url]);

		bad.rejectWrites = false;
		clock += 60_000;
		await engine.flush();
		expect(bad.events.map((e) => e.id)).toContain(wrap.id);
		expect(await alice.storage.outbox.due(Infinity)).toHaveLength(0);
		expect(sent).toHaveLength(1); // "enviada" não é avisado de novo
	});
});

describe('pool', () => {
	it('hold() abre e segura a conexão até ser liberada', async () => {
		const r = await relay();
		const me = await person();
		const pool = new RelayPool({ signer: async (t) => me.vault.sign(t), socket, idleCloseMs: 100 });
		cleanup.push(() => pool.close());
		const held = pool.hold([r.url]);
		await until(() => pool.connectedUrls().length === 1);
		await new Promise((resolve) => setTimeout(resolve, 300));
		expect(pool.connectedUrls()).toEqual([r.url]);
		held.release();
		await until(() => pool.connectedUrls().length === 0);
	});

	it('fecha conexões paradas sem assinatura, mas mantém as que assinam', async () => {
		const [publishOnly, subscribed] = [await relay(), await relay()];
		const me = await person();
		const pool = new RelayPool({ signer: async (t) => me.vault.sign(t), socket, idleCloseMs: 100 });
		cleanup.push(() => pool.close());
		pool.subscribe([subscribed.url], () => [{ kinds: [1], limit: 1 }], () => ({ onevent: () => {} }));
		await pool.publish([publishOnly.url], me.vault.sign(dmRelayListTemplate(['wss://x.example'])));
		await until(() => pool.connectedUrls().length === 2);
		await until(() => pool.connectedUrls().length === 1);
		expect(pool.connectedUrls()).toEqual([subscribed.url]);
	});
});

describe('relays de DM (kind 10050)', () => {
	it('publica a minha lista e descobre a de um contato, só se assinada por ele', async () => {
		const r = await relay();
		const alice = await person();
		const event = alice.vault.sign(dmRelayListTemplate(['wss://a.example', 'wss://b.example']));
		await alice.pool.publish([r.url], event);

		const bob = await person();
		expect(await fetchDmRelays(bob.pool, [r.url], alice.publicKey)).toEqual(['wss://a.example', 'wss://b.example']);

		// um 10050 com a chave da Alice, mas assinatura falsa, é ignorado
		r.events.push({ ...event, id: 'f'.repeat(64), created_at: event.created_at + 10, tags: [['relay', 'wss://golpe.example']] });
		expect(await fetchDmRelays(bob.pool, [r.url], alice.publicKey)).toEqual(['wss://a.example', 'wss://b.example']);
	});
});
