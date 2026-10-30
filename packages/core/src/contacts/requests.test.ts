import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { KdfParams } from '../crypto/seal.ts';
import { directConversationId, storeIncoming } from '../conversations/messaging.ts';
import { createVault } from '../identity/vault.ts';
import { openStorage } from '../storage/repositories.ts';
import { acceptRequest, blockContact, listBlocked, listRequests, MAX_SUSPECTS, trimSuspects, unblockContact } from './requests.ts';

const FAST: KdfParams = { memoryKiB: 64, iterations: 1, parallelism: 1 };
const closers: Array<() => void> = [];
afterEach(() => closers.splice(0).forEach((c) => c()));

let n = 0;
async function setup() {
	const alice = createVault({ kdf: FAST });
	const bob = createVault({ kdf: FAST });
	const a = await alice.create('123456');
	const b = await bob.create('123456');
	const storage = openStorage(`pedidos-${n++}`);
	closers.push(() => storage.close());
	const send = async (text: string, options: { proven?: boolean } = {}) =>
		storeIncoming(storage, b.publicKey, bob.unwrap(alice.wrapDirectMessage(b.publicKey, text).toRecipient), options);
	/** Uma mensagem sem prova de alguém novo, a cada vez (horários crescentes). */
	const stranger = async (createdAt: number) => {
		const vault = createVault({ kdf: FAST });
		await vault.create('123456');
		const wrap = vault.wrapDirectMessage(b.publicKey, 'promoção imperdível', [], 14, createdAt).toRecipient;
		return storeIncoming(storage, b.publicKey, bob.unwrap(wrap), { proven: false });
	};
	return { storage, alice: a.publicKey, send, stranger };
}

describe('pedidos de mensagem e bloqueio (RF-12, RF-13)', () => {
	it('quem não é contato vira pedido, com a conversa; aceitar vira contato', async () => {
		const { storage, alice, send } = await setup();
		await send('oi, sou da operadora');
		const requests = await listRequests(storage);
		expect(requests.map((r) => r.contact.publicKey)).toEqual([alice]);
		expect(requests[0].conversation.lastMessagePreview).toBe('oi, sou da operadora');

		await acceptRequest(storage, alice);
		expect(await listRequests(storage)).toEqual([]);
		expect((await storage.contacts.get(alice))?.state).toBe('aceito');
	});

	it('quem é contato aceito não é pedido, e aceitar não mexe em bloqueado', async () => {
		const { storage, alice, send } = await setup();
		await storage.contacts.put({ publicKey: alice, state: 'aceito', dmRelays: [], addedAt: 1 });
		await send('oi');
		expect(await listRequests(storage)).toEqual([]);
		await storage.contacts.put({ publicKey: alice, state: 'bloqueado', dmRelays: [], addedAt: 1 });
		await acceptRequest(storage, alice);
		expect((await storage.contacts.get(alice))?.state).toBe('bloqueado');
	});

	it('bloquear apaga a conversa e descarta o que vier depois; desbloquear volta a receber, como pedido', async () => {
		const { storage, alice, send } = await setup();
		await send('primeira');
		await blockContact(storage, alice, async () => {});
		expect(await storage.conversations.get(directConversationId(alice))).toBeUndefined();
		expect((await listBlocked(storage)).map((c) => c.publicKey)).toEqual([alice]);

		expect(await send('segunda')).toBeUndefined();
		expect(await storage.conversations.listByRecent()).toEqual([]);
		expect(await listRequests(storage)).toEqual([]);

		await unblockContact(storage, alice);
		expect(await listBlocked(storage)).toEqual([]);
		await send('terceira');
		expect((await listRequests(storage)).map((r) => r.contact.publicKey)).toEqual([alice]);
		expect(await storage.messages.listByConversation(directConversationId(alice), 10)).toHaveLength(1); // só a terceira
	});

	it('bloquear quem nunca escreveu cria o registro bloqueado', async () => {
		const { storage, alice, send } = await setup();
		await blockContact(storage, alice, async () => {});
		expect((await storage.contacts.get(alice))?.state).toBe('bloqueado');
		expect(await send('oi')).toBeUndefined();
	});
});

describe('possível spam (RF-90)', () => {
	it('sem a prova, o pedido fica à parte; uma mensagem seguinte com a prova o põe nos pedidos normais', async () => {
		const { storage, alice, send } = await setup();
		await send('oi', { proven: false });
		expect((await listRequests(storage)).map((r) => r.suspect)).toEqual([true]);
		await send('atualizei o app');
		expect((await listRequests(storage)).map((r) => r.suspect)).toEqual([false]);
		expect((await storage.contacts.get(alice))?.unproven).toBeUndefined();
	});

	it('a falta de prova não mexe em quem já é contato, e aceitar tira a marca', async () => {
		const { storage, alice, send } = await setup();
		await storage.contacts.put({ publicKey: alice, state: 'aceito', dmRelays: [], addedAt: 1 });
		await send('oi', { proven: false });
		expect(await storage.contacts.get(alice)).toMatchObject({ state: 'aceito' });
		expect((await storage.contacts.get(alice))?.unproven).toBeUndefined();

		const other = await setup();
		await other.send('oi', { proven: false });
		await acceptRequest(other.storage, other.alice);
		expect(await other.storage.contacts.get(other.alice)).toMatchObject({ state: 'aceito' });
		expect((await other.storage.contacts.get(other.alice))?.unproven).toBeUndefined();
	});

	it(`guarda no máximo ${MAX_SUSPECTS} conversas de possível spam; as mais antigas saem`, async () => {
		const { storage, send, stranger } = await setup();
		await send('pedido de verdade');
		for (let i = 0; i < MAX_SUSPECTS + 2; i++) await stranger(1_000 + i);
		await trimSuspects(storage, async () => {});
		const requests = await listRequests(storage);
		expect(requests.filter((r) => r.suspect)).toHaveLength(MAX_SUSPECTS);
		expect(requests.filter((r) => !r.suspect)).toHaveLength(1);
		const times = requests.filter((r) => r.suspect).map((r) => r.conversation.lastMessageAt);
		expect(Math.min(...times)).toBe(1_002);
		// cria um cofre por remetente: passa dos 5 s padrão em máquina mais lenta, como a CI
	}, 30_000);
});
