import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { createRumor } from 'nostr-tools/nip59';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import type { KdfParams } from '../crypto/seal.ts';
import { createVault, type Rumor } from '../identity/vault.ts';
import { openStorage } from '../storage/repositories.ts';
import { directConversationId, markRead, markSent, mediaTags, NAME_TAG, nameTagFor, storeIncoming, storeOutgoing } from './messaging.ts';

const FAST: KdfParams = { memoryKiB: 64, iterations: 1, parallelism: 1 };
const closers: Array<() => void> = [];
afterEach(() => closers.splice(0).forEach((c) => c()));

let n = 0;
async function device(vault?: ReturnType<typeof createVault>, restoreFrom?: string[]) {
	const v = vault ?? createVault({ kdf: FAST });
	let publicKey: string;
	let words: string[];
	if (restoreFrom) {
		publicKey = (await v.restore(restoreFrom, '123456')).publicKey;
		words = restoreFrom;
	} else {
		({ publicKey, words } = await v.create('123456'));
	}
	const storage = openStorage(`conversas-${n++}`);
	closers.push(() => storage.close());
	return { vault: v, publicKey, words, storage };
}

describe('conversas 1:1', () => {
	it('Alice envia, Bob recebe: a mensagem aparece na conversa certa, com não lida', async () => {
		const alice = await device();
		const bob = await device();
		const { rumor, toRecipient } = alice.vault.wrapDirectMessage(bob.publicKey, 'oi Bob');

		const sent = await storeOutgoing(alice.storage, rumor, bob.publicKey);
		expect(sent.message.status).toBe('pendente');
		expect(sent.conversation.id).toBe(directConversationId(bob.publicKey));

		const got = await storeIncoming(bob.storage, bob.publicKey, bob.vault.unwrap(toRecipient));
		expect(got?.message).toMatchObject({ text: 'oi Bob', status: 'recebida', conversationId: directConversationId(alice.publicKey) });
		expect(got?.conversation).toMatchObject({ unread: 1, lastMessagePreview: 'oi Bob' });
	});

	it('a minha cópia aparece como enviada no meu outro aparelho', async () => {
		const alice = await device();
		const aliceTablet = await device(createVault({ kdf: FAST }), alice.words);
		const bob = await device();
		const { toSelf } = alice.vault.wrapDirectMessage(bob.publicKey, 'mandei do celular');

		const got = await storeIncoming(aliceTablet.storage, aliceTablet.publicKey, aliceTablet.vault.unwrap(toSelf));
		expect(got?.message.status).toBe('enviada');
		expect(got?.conversation.id).toBe(directConversationId(bob.publicKey));
		expect(got?.conversation.unread).toBe(0);
	});

	it('a mesma mensagem vinda duas vezes entra uma vez só', async () => {
		const alice = await device();
		const bob = await device();
		const { rumor, toSelf } = alice.vault.wrapDirectMessage(bob.publicKey, 'oi');
		await storeOutgoing(alice.storage, rumor, bob.publicKey);
		// a cópia volta pela rede para o próprio aparelho que enviou
		const again = await storeIncoming(alice.storage, alice.publicKey, alice.vault.unwrap(toSelf));
		expect(again?.isNew).toBe(false);
		expect(again?.message.status).toBe('pendente');
	});

	it('não conta como não lida se a conversa está aberta; ler zera o contador', async () => {
		const alice = await device();
		const bob = await device();
		const conversationId = directConversationId(alice.publicKey);
		const open = await storeIncoming(bob.storage, bob.publicKey, bob.vault.unwrap(alice.vault.wrapDirectMessage(bob.publicKey, 'a').toRecipient), { openConversationId: conversationId });
		expect(open?.conversation.unread).toBe(0);
		await storeIncoming(bob.storage, bob.publicKey, bob.vault.unwrap(alice.vault.wrapDirectMessage(bob.publicKey, 'b').toRecipient));
		await storeIncoming(bob.storage, bob.publicKey, bob.vault.unwrap(alice.vault.wrapDirectMessage(bob.publicKey, 'c').toRecipient));
		expect((await bob.storage.conversations.get(conversationId))?.unread).toBe(2);
		await markRead(bob.storage, conversationId);
		expect((await bob.storage.conversations.get(conversationId))?.unread).toBe(0);
	});

	it('o nome vai na primeira mensagem; desconhecido vira pedido com esse nome', async () => {
		const alice = await device();
		const bob = await device();
		const tags = await nameTagFor(alice.storage, bob.publicKey, 'Alice');
		expect(tags).toEqual([[NAME_TAG, 'Alice']]);
		const first = alice.vault.wrapDirectMessage(bob.publicKey, 'oi', tags);
		await storeOutgoing(alice.storage, first.rumor, bob.publicKey);
		expect(await nameTagFor(alice.storage, bob.publicKey, 'Alice')).toEqual([]);

		await storeIncoming(bob.storage, bob.publicKey, bob.vault.unwrap(first.toRecipient));
		expect(await bob.storage.contacts.get(alice.publicKey)).toMatchObject({ state: 'pedido', chosenName: 'Alice' });
	});

	it('o nome que chega não muda o nome local que dei ao contato (RF-14)', async () => {
		const alice = await device();
		const bob = await device();
		await bob.storage.contacts.put({ publicKey: alice.publicKey, localName: 'Tia Alice', state: 'aceito', dmRelays: [], addedAt: 0 });
		const msg = alice.vault.wrapDirectMessage(bob.publicKey, 'oi', [[NAME_TAG, 'Alice Nova']]);
		await storeIncoming(bob.storage, bob.publicKey, bob.vault.unwrap(msg.toRecipient));
		expect(await bob.storage.contacts.get(alice.publicKey)).toMatchObject({ localName: 'Tia Alice', chosenName: 'Alice Nova', state: 'aceito' });
	});

	it('"pendente" vira "enviada" quando um relay aceita', async () => {
		const alice = await device();
		const bob = await device();
		const { rumor } = alice.vault.wrapDirectMessage(bob.publicKey, 'oi');
		await storeOutgoing(alice.storage, rumor, bob.publicKey);
		await markSent(alice.storage, rumor.id);
		expect((await alice.storage.messages.get(rumor.id))?.status).toBe('enviada');
	});

	it('mensagem mais antiga que chega depois não troca a prévia da conversa', async () => {
		const bob = await device();
		const aliceKey = generateSecretKey();
		const rumorAt = (text: string, created_at: number) =>
			({ ...createRumor({ kind: 14, content: text, tags: [['p', bob.publicKey]], created_at }, aliceKey) }) as Rumor;
		await storeIncoming(bob.storage, bob.publicKey, rumorAt('nova', 2000));
		const conv = await storeIncoming(bob.storage, bob.publicKey, rumorAt('velha', 1000));
		expect(conv?.conversation.lastMessagePreview).toBe('nova');
		expect((await bob.storage.messages.listByConversation(conv!.conversation.id, 10)).map((m) => m.text)).toEqual(['velha', 'nova']);
	});

	it('áudio (kind 15): vai e volta com tudo o que é preciso para baixar e decifrar', async () => {
		const alice = await device();
		const bob = await device();
		const media = {
			ox: 'a'.repeat(64),
			x: 'b'.repeat(64),
			type: 'audio/webm;codecs=opus',
			size: 12345,
			urls: ['https://um.example/' + 'b'.repeat(64), 'https://dois.example/' + 'b'.repeat(64)],
			key: 'c'.repeat(64),
			nonce: 'd'.repeat(24),
			duration: 7
		};
		const wrapped = alice.vault.wrapDirectMessage(bob.publicKey, media.urls[0], mediaTags(media), 15);
		const sent = await storeOutgoing(alice.storage, wrapped.rumor, bob.publicKey);
		expect(sent.message.media).toEqual(media);
		expect(sent.conversation.lastMessagePreview).toBe('🎤 Áudio');

		const got = await storeIncoming(bob.storage, bob.publicKey, bob.vault.unwrap(wrapped.toRecipient));
		expect(got?.message).toMatchObject({ kind: 15, text: '', media });
	});

	it('ignora arquivo sem chave ou com outra cifra', async () => {
		const bob = await device();
		const key = generateSecretKey();
		const broken = createRumor({ kind: 15, content: 'https://x.example/f', tags: [['p', bob.publicKey], ['file-type', 'audio/ogg']] }, key) as Rumor;
		expect(await storeIncoming(bob.storage, bob.publicKey, broken)).toBeUndefined();
	});

	it('ignora o que o M1 ainda não trata: grupos e outros tipos', async () => {
		const bob = await device();
		const key = generateSecretKey();
		const group = createRumor({ kind: 14, content: 'grupo', tags: [['p', bob.publicKey], ['p', getPublicKey(generateSecretKey())]] }, key) as Rumor;
		const reaction = createRumor({ kind: 7, content: '👍', tags: [['p', bob.publicKey]] }, key) as Rumor;
		expect(await storeIncoming(bob.storage, bob.publicKey, group)).toBeUndefined();
		expect(await storeIncoming(bob.storage, bob.publicKey, reaction)).toBeUndefined();
	});

	it('o cofre recusa mensagem vazia, longa demais ou para destinatário inválido', async () => {
		const alice = await device();
		expect(() => alice.vault.wrapDirectMessage('xyz', 'oi')).toThrow(/destinatário/);
		expect(() => alice.vault.wrapDirectMessage(getPublicKey(generateSecretKey()), '   ')).toThrow(/vazia/);
		expect(() => alice.vault.wrapDirectMessage(getPublicKey(generateSecretKey()), 'x'.repeat(4001))).toThrow(/longa/);
	});
});
