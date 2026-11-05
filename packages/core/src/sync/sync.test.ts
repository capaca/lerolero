import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket as NodeWebSocket } from 'ws';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { wrapEvent } from 'nostr-tools/nip59';
import type { KdfParams } from '../crypto/seal.ts';
import { createVault } from '../identity/vault.ts';
import { RelayConnection, type SocketFactory } from '../net/connection.ts';
import { RelayPool } from '../net/pool.ts';
import { openStorage, type Storage } from '../storage/repositories.ts';
import { FakeRelay } from '../testing/fake-relay.ts';
import { CURSOR_MARGIN_S, dmRelayListTemplate, fetchDmRelays, SYNC_GENERATION, SyncEngine, upgradeSyncGeneration } from './engine.ts';

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

	it('se o app morre no meio de processar um embrulho, a próxima sincronização o processa de novo', async () => {
		// achado no e2e (2026-10-26): recarregar a página enquanto a mensagem chegava a perdia para sempre,
		// porque o embrulho era marcado como visto antes de a mensagem ser guardada
		const r = await relay();
		const bob = await person();
		const wrap = wrapFor(bob.publicKey, 'chegou na hora do reload');
		r.events.push(wrap);

		let started = false;
		const dying = new SyncEngine({
			storage: bob.storage,
			pool: bob.pool,
			myPublicKey: bob.publicKey,
			events: { onWrap: () => ((started = true), new Promise<void>(() => {})) } // nunca termina: o app morreu
		});
		await dying.start([r.url]);
		await until(() => started);
		dying.stop();

		const received: string[] = [];
		const next = new SyncEngine({
			storage: bob.storage,
			pool: bob.pool,
			myPublicKey: bob.publicKey,
			events: { onWrap: async (w) => void received.push(w.id) }
		});
		cleanup.push(() => next.stop());
		await next.start([r.url]);
		await until(() => received.length > 0);
		expect(received).toEqual([wrap.id]);
		await until(() => bob.storage.seenWraps.has(wrap.id)); // e, processado, não vem de novo
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

	it('embrulho datado do futuro não leva o cursor para lá (P1, T26)', async () => {
		// achado na revisão de prontidão (2026-11-05): um kind 1059 de 2030 levava o cursor junto e, na próxima
		// conexão, o relay não entregava mais nada guardado
		const r = await relay();
		const bob = await person();
		const now = Math.floor(Date.now() / 1000);
		const future = (created_at: number) =>
			finalizeEvent({ kind: 1059, created_at, tags: [['p', bob.publicKey]], content: 'x' }, generateSecretKey());
		const far = future(Math.floor(Date.UTC(2030, 0, 1) / 1000));
		const near = future(now + 10 * 60); // relógio de quem mandou adiantado 10 min: ainda chega
		const good = wrapFor(bob.publicKey, 'boa');
		r.events.push(far, near, good);

		const received: string[] = [];
		const engine = new SyncEngine({ storage: bob.storage, pool: bob.pool, myPublicKey: bob.publicKey, events: { onWrap: async (w) => void received.push(w.id) } });
		cleanup.push(() => engine.stop());
		await engine.start([r.url]);
		await until(() => received.includes(good.id) && received.includes(near.id));

		expect(received).not.toContain(far.id);
		const cursor = (await bob.storage.sync.getCursor(r.url))!;
		expect(cursor).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
		expect(cursor).toBeGreaterThanOrEqual(now);
	});

	it('cursor guardado no futuro volta ao relógio ao abrir (P1, T26)', async () => {
		// aparelhos travados antes da correção voltam a receber o histórico
		const r = await relay();
		const bob = await person();
		await bob.storage.sync.setCursor(r.url, Math.floor(Date.UTC(2030, 0, 1) / 1000));
		const wrap = wrapFor(bob.publicKey, 'guardada');
		r.events.push(wrap);

		const received: string[] = [];
		const engine = new SyncEngine({ storage: bob.storage, pool: bob.pool, myPublicKey: bob.publicKey, events: { onWrap: async (w) => void received.push(w.id) } });
		cleanup.push(() => engine.stop());
		await engine.start([r.url]);
		await until(() => received.length > 0);
		expect(received).toEqual([wrap.id]);
	});

	it('o cursor só avança quando o histórico termina de ser processado (P2)', async () => {
		// achado na revisão de prontidão (2026-11-05): o relay manda o mais novo primeiro e o cursor ia para ele;
		// fechar o app antes de processar os mais antigos os pulava para sempre
		const r = await relay();
		const bob = await person();
		const now = Math.floor(Date.now() / 1000);
		const at = (created_at: number) =>
			finalizeEvent({ kind: 1059, created_at, tags: [['p', bob.publicKey]], content: 'x' }, generateSecretKey());
		const newer = at(now - 60);
		const older = at(now - 3600);
		r.events.push(newer, older);

		const processed: string[] = [];
		const dying = new SyncEngine({
			storage: bob.storage,
			pool: bob.pool,
			myPublicKey: bob.publicKey,
			events: {
				onWrap: async (w) => {
					if (w.id === older.id) await new Promise<void>(() => {}); // nunca termina: o app morreu
					processed.push(w.id);
				}
			}
		});
		await dying.start([r.url]);
		await until(() => processed.includes(newer.id));
		await new Promise((res) => setTimeout(res, 200));
		dying.stop();
		expect(await bob.storage.sync.getCursor(r.url)).toBeUndefined();
	});

	it('pede o histórico em partes quando o relay corta no limite de resultados (P2)', async () => {
		const r = await relay();
		r.maxResults = 2;
		const bob = await person();
		const now = Math.floor(Date.now() / 1000);
		const wraps = [1, 2, 3, 4, 5].map((h) =>
			finalizeEvent({ kind: 1059, created_at: now - h * 3600, tags: [['p', bob.publicKey]], content: 'x' }, generateSecretKey())
		);
		r.events.push(...wraps);

		const received: string[] = [];
		const engine = new SyncEngine({ storage: bob.storage, pool: bob.pool, myPublicKey: bob.publicKey, events: { onWrap: async (w) => void received.push(w.id) } });
		cleanup.push(() => engine.stop());
		await engine.start([r.url]);
		await until(async () => (await bob.storage.sync.getCursor(r.url)) !== undefined);
		expect(received.sort()).toEqual(wraps.map((w) => w.id).sort());
		expect(await bob.storage.sync.getCursor(r.url)).toBe(now - 3600);
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
		// o "quebrado" tem a assinatura invalidada pelo conteúdo trocado: injetado direto no relay,
		// antes de assinar, para vir no histórico (o relay falso só repassa ao vivo o que é publicado)
		const broken = { ...wrapFor(bob.publicKey, 'x'), content: 'lixo' };
		r.events.push(broken);
		await engine.start([r.url]);
		const alice = await person();
		const good = wrapFor(bob.publicKey, 'boa');
		await alice.pool.publish([r.url], good);
		// a ordem de chegada varia: o NIP-59 sorteia o horário de cada embrulho
		await until(async () => ok.includes(good.id) && (await bob.storage.seenWraps.has(broken.id)));
		expect(ok).toEqual([good.id]);
	});

	it('embrulho que falhou por motivo passageiro não é marcado como visto e vem de novo (P3)', async () => {
		// achado na revisão de prontidão (2026-11-05): cota cheia, worker ou cofre trancado no meio da
		// sincronização descartavam a mensagem para sempre
		const r = await relay();
		const bob = await person();
		const wrap = wrapFor(bob.publicKey, 'chegou com a cota cheia');
		r.events.push(wrap);

		let failed = false;
		const full = new SyncEngine({
			storage: bob.storage,
			pool: bob.pool,
			myPublicKey: bob.publicKey,
			events: {
				onWrap: async () => {
					failed = true;
					throw new DOMException('cota cheia', 'QuotaExceededError');
				}
			}
		});
		await full.start([r.url]);
		await until(() => failed);
		await new Promise((res) => setTimeout(res, 200));
		await full.stop();
		expect(await bob.storage.seenWraps.has(wrap.id)).toBe(false);
		expect(await bob.storage.sync.getCursor(r.url)).toBeUndefined();

		const received: string[] = [];
		const next = new SyncEngine({ storage: bob.storage, pool: bob.pool, myPublicKey: bob.publicKey, events: { onWrap: async (w) => void received.push(w.id) } });
		cleanup.push(() => next.stop());
		await next.start([r.url]);
		await until(() => received.length > 0);
		expect(received).toEqual([wrap.id]);
	});

	it('o cursor não passa de um embrulho que falhou, nem com outro chegando depois (P3)', async () => {
		const r = await relay();
		const bob = await person();
		const now = Math.floor(Date.now() / 1000);
		const at = (created_at: number) =>
			finalizeEvent({ kind: 1059, created_at, tags: [['p', bob.publicKey]], content: 'x' }, generateSecretKey());
		const failing = at(now - 3600);
		r.events.push(failing);

		const received: string[] = [];
		const engine = new SyncEngine({
			storage: bob.storage,
			pool: bob.pool,
			myPublicKey: bob.publicKey,
			events: {
				onWrap: async (w) => {
					if (w.id === failing.id) throw new Error('worker reiniciou');
					received.push(w.id);
				}
			}
		});
		cleanup.push(() => engine.stop());
		await engine.start([r.url]);
		const live = wrapFor(bob.publicKey, 'ao vivo');
		await (await person()).pool.publish([r.url], live);
		await until(() => received.includes(live.id));
		await new Promise((res) => setTimeout(res, 200));
		expect(await bob.storage.sync.getCursor(r.url)).toBeUndefined();
	});

	it('stop() espera o embrulho em processamento e deixa o resto da fila para a próxima (P3)', async () => {
		// "Bloquear" no meio da sincronização: o cofre tranca logo depois de stop()
		const r = await relay();
		const bob = await person();
		const wraps = [wrapFor(bob.publicKey, 'um'), wrapFor(bob.publicKey, 'dois'), wrapFor(bob.publicKey, 'três')];
		r.events.push(...wraps);

		let release!: () => void;
		const slow = new Promise<void>((res) => (release = res));
		const processed: string[] = [];
		let started = false;
		const engine = new SyncEngine({
			storage: bob.storage,
			pool: bob.pool,
			myPublicKey: bob.publicKey,
			events: {
				onWrap: async (w) => {
					started = true;
					await slow;
					processed.push(w.id);
				}
			}
		});
		await engine.start([r.url]);
		await until(() => started);
		let stopped = false;
		const stopping = engine.stop().then(() => (stopped = true));
		await new Promise((res) => setTimeout(res, 100));
		expect(stopped).toBe(false);
		release();
		await stopping;

		expect(processed).toHaveLength(1);
		expect(await bob.storage.seenWraps.has(processed[0])).toBe(true);
		for (const w of wraps.filter((w) => w.id !== processed[0])) expect(await bob.storage.seenWraps.has(w.id)).toBe(false);
	});

	it('volta a receber depois de uma queda de conexão', async () => {
		const r = await relay();
		const bob = await person();
		const received: string[] = [];
		const engine = new SyncEngine({ storage: bob.storage, pool: bob.pool, myPublicKey: bob.publicKey, events: { onWrap: async (w) => void received.push(w.id) } });
		cleanup.push(() => engine.stop());
		await engine.start([r.url]);
		await until(() => bob.pool.connectedUrls().length === 1);

		// a reconexão leva ~50 ms: esperar ver "0 conectados" perde a janela sob carga; o contador do relay não perde
		const antes = r.accepted;
		r.dropConnections();
		await until(() => r.accepted > antes && bob.pool.connectedUrls().length === 1);

		const wrap = wrapFor(bob.publicKey, 'depois da queda');
		await (await person()).pool.publish([r.url], wrap);
		await until(() => received.includes(wrap.id), 15_000);
	});

	it('volta a receber mesmo se a conexão cair no meio da autenticação', async () => {
		const r = await relay();
		const bob = await person();
		const received: string[] = [];
		const engine = new SyncEngine({ storage: bob.storage, pool: bob.pool, myPublicKey: bob.publicKey, events: { onWrap: async (w) => void received.push(w.id) } });
		cleanup.push(() => engine.stop());
		// o relay nunca responde ao AUTH da primeira conexão: ela fica no meio da autenticação quando cai
		r.ignoreAuth = true;
		await engine.start([r.url]);
		await until(() => bob.pool.connectedUrls().length === 1);
		await until(() => r.pendingAuth > 0);

		r.ignoreAuth = false;
		const antes = r.accepted;
		r.dropConnections();
		await until(() => r.accepted > antes && bob.pool.connectedUrls().length === 1);

		const wrap = wrapFor(bob.publicKey, 'depois da queda na autenticação');
		await (await person()).pool.publish([r.url], wrap);
		// bem antes dos 2 s de espera da autenticação perdida: a nova conexão não pode herdá-la
		await until(() => received.includes(wrap.id), 1500);
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

describe('ordem e espera da fila de envio', () => {
	async function offlineEngine(canSend?: () => boolean) {
		const r = await relay();
		const port = r.currentPort;
		await r.stop();
		const alice = await person();
		const clock = { now: Date.now() };
		const sent: string[] = [];
		const engine = new SyncEngine({
			storage: alice.storage,
			pool: alice.pool,
			myPublicKey: alice.publicKey,
			now: () => clock.now,
			canSend,
			events: { onWrap: async () => {}, onSent: async (item) => void sent.push(item.messageId!) }
		});
		cleanup.push(() => engine.stop());
		const to = getPublicKey(generateSecretKey());
		return { r, port, alice, clock, sent, engine, url: `ws://127.0.0.1:${port}`, wrap: (text: string) => wrapFor(to, text) };
	}

	it('sai na ordem em que foi escrita, mesmo quando a primeira já falhou mais vezes', async () => {
		const { r, port, clock, sent, engine, url, wrap } = await offlineEngine();
		const [a, b, c] = [wrap('a'), wrap('b'), wrap('c')];
		await engine.enqueue(a, [url], 'a');
		clock.now += 6_000;
		await engine.flush(); // a falha de novo: espera de 15 s
		clock.now += 1_000;
		await engine.enqueue(b, [url], 'b'); // b falha uma vez: espera de 5 s, menor que a de a
		await engine.enqueue(c, [url], 'c');

		await r.start(port);
		clock.now += 60_000; // todas já podem ser tentadas
		await engine.flush();
		expect(sent).toEqual(['a', 'b', 'c']);
		expect(r.events.map((e) => e.id)).toEqual([a.id, b.id, c.id]);
	});

	it('ao voltar a conexão, tenta já, sem esperar o tempo da tentativa anterior', async () => {
		const { r, port, alice, sent, engine, url, wrap } = await offlineEngine();
		await engine.enqueue(wrap('oi'), [url], 'oi'); // falha: próxima tentativa só daqui a 5 s
		expect(sent).toEqual([]);

		await r.start(port);
		engine.resume(); // sem mexer no relógio
		await until(() => sent.length === 1);
		expect(await alice.storage.outbox.due(Infinity)).toHaveLength(0);
	});

	it('sem internet no aparelho não gasta tentativas, e sai quando ela volta', async () => {
		let online = false;
		const { r, port, alice, sent, engine, url, wrap } = await offlineEngine(() => online);
		await engine.enqueue(wrap('um'), [url], 'um');
		await engine.enqueue(wrap('dois'), [url], 'dois');
		const queued = await alice.storage.outbox.due(Infinity);
		expect(queued.map((i) => i.attempts)).toEqual([0, 0]);

		await r.start(port);
		online = true;
		engine.resume();
		await until(() => sent.length === 2);
		expect(sent).toEqual(['um', 'dois']);
	});
});

describe('geração da sincronização', () => {
	it('depois de atualizar, reprocessa o que uma versão antiga ignorou e marcou como visto', async () => {
		const r = await relay();
		const bob = await person();
		// versão antiga: recebe, não entende (ignora) e marca como visto
		const ignored: string[] = [];
		const old = new SyncEngine({ storage: bob.storage, pool: bob.pool, myPublicKey: bob.publicKey, events: { onWrap: async (w) => void ignored.push(w.id) } });
		const wrap = wrapFor(bob.publicKey, 'áudio que a versão antiga não entendia');
		r.events.push(wrap);
		await old.start([r.url]);
		await until(() => ignored.length === 1);
		old.stop();
		expect(await bob.storage.seenWraps.has(wrap.id)).toBe(true);

		// versão nova: sobe a geração e recebe de novo
		expect(await upgradeSyncGeneration(bob.storage)).toBe(true);
		expect(await upgradeSyncGeneration(bob.storage)).toBe(false); // só uma vez
		const received: string[] = [];
		const fresh = new SyncEngine({ storage: bob.storage, pool: bob.pool, myPublicKey: bob.publicKey, events: { onWrap: async (w) => void received.push(w.id) } });
		cleanup.push(() => fresh.stop());
		await fresh.start([r.url]);
		await until(() => received.length === 1);
		expect(received).toEqual([wrap.id]);
		expect(await bob.storage.settings.get('geracaoSync')).toBe(SYNC_GENERATION);
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
