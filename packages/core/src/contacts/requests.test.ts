import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { KdfParams } from '../crypto/seal.ts';
import { directConversationId, storeIncoming } from '../conversations/messaging.ts';
import { createVault } from '../identity/vault.ts';
import { openStorage } from '../storage/repositories.ts';
import { acceptRequest, blockContact, listBlocked, listRequests, unblockContact } from './requests.ts';

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
	const send = async (text: string) => storeIncoming(storage, b.publicKey, bob.unwrap(alice.wrapDirectMessage(b.publicKey, text).toRecipient));
	return { storage, alice: a.publicKey, send };
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
