// Teste contra os relays de verdade da lista padrão (relays.json). Usa a internet,
// então não roda na CI: `pnpm test:rede`.
import 'fake-indexeddb/auto';
import { afterAll, describe, expect, it } from 'vitest';
import { generateSecretKey } from 'nostr-tools/pure';
import { wrapEvent } from 'nostr-tools/nip59';
import published from '../../../../relays.json' with { type: 'json' };
import { createVault } from '../identity/vault.ts';
import { RelayPool } from '../net/pool.ts';
import { parseRelayList } from '../relays.ts';
import { openStorage } from '../storage/repositories.ts';
import { dmRelayListTemplate, fetchDmRelays, SyncEngine } from './engine.ts';

const list = parseRelayList(published);
const closers: Array<() => void> = [];
afterAll(() => closers.forEach((c) => c()));

async function person(name: string) {
	const vault = createVault({ kdf: { memoryKiB: 64, iterations: 1, parallelism: 1 } });
	const { publicKey } = await vault.create('123456');
	const storage = openStorage(`rede-${name}-${Date.now()}`);
	const pool = new RelayPool({ signer: async (t) => vault.sign(t), timeoutMs: 15_000 });
	closers.push(() => pool.close(), () => storage.close());
	return { vault, publicKey, storage, pool };
}

describe.skipIf(!process.env.REDE)('relays de verdade', () => {
	it(
		'Alice publica seus relays; Bob os descobre, envia pela fila, e Alice recebe pela sincronização',
		async () => {
			const alice = await person('alice');
			const bob = await person('bob');

			// 1. Alice publica o kind 10050 nos relays gerais e nos dela
			const dmRelays = list.dm;
			const listEvent = alice.vault.sign(dmRelayListTemplate(dmRelays));
			const pub = await alice.pool.publish([...list.geral, ...dmRelays], listEvent);
			console.log('10050 publicado:', Object.entries(pub).map(([u, r]) => `${u.replace('wss://', '')} ${r.ok ? 'ok' : `NÃO (${r.message})`}`).join(' · '));

			// 2. Alice começa a receber
			const received: string[] = [];
			let receivedAt = 0;
			const engine = new SyncEngine({
				storage: alice.storage,
				pool: alice.pool,
				myPublicKey: alice.publicKey,
				events: {
					onWrap: async (wrap, relay) => {
						const rumor = alice.vault.unwrap(wrap);
						received.push(`${rumor.content} (via ${relay.replace('wss://', '')})`);
						receivedAt ||= Date.now();
					}
				}
			});
			closers.push(() => engine.stop());
			await engine.start(dmRelays);

			// 3. Bob descobre onde a Alice recebe, consultando a rede
			const found = await fetchDmRelays(bob.pool, list.geral, alice.publicKey);
			console.log('Bob descobriu:', found.join(', '));
			expect(found.sort()).toEqual([...dmRelays].sort());

			// 4. Bob envia pela fila
			const bobEngine = new SyncEngine({ storage: bob.storage, pool: bob.pool, myPublicKey: bob.publicKey, events: { onWrap: async () => {} } });
			closers.push(() => bobEngine.stop());
			const secret = generateSecretKey(); // remetente de teste (no app, o cofre do Bob embrulha)
			const wrap = wrapEvent({ kind: 14, content: 'oi Alice, aqui é o Bob', tags: [['p', alice.publicKey]] }, secret, alice.publicKey);
			const sendStart = Date.now();
			await bobEngine.enqueue(wrap, found, 'm1');
			const queue = await bob.storage.outbox.due(Infinity);
			console.log('fila do Bob depois do envio:', queue.length === 0 ? 'vazia (todos aceitaram)' : `aceito por ${queue[0].acceptedBy.length} de ${queue[0].relays.length}`);

			// 5. Alice recebe
			const end = Date.now() + 20_000;
			while (received.length === 0 && Date.now() < end) await new Promise((r) => setTimeout(r, 100));
			console.log('Alice recebeu:', received, `em ${receivedAt - sendStart} ms desde o envio`);
			expect(received.length).toBeGreaterThan(0);
			expect(received.length).toBe(1); // repetidos dos outros relays foram descartados
		},
		60_000
	);
});
