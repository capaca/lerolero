import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { createRumor } from 'nostr-tools/nip59';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import type { KdfParams } from '../crypto/seal.ts';
import { createVault, type Rumor } from '../identity/vault.ts';
import { openStorage } from '../storage/repositories.ts';
import {
	deleteForMe,
	deletionTags,
	directConversationId,
	markDeleted,
	markRead,
	markSent,
	mediaTags,
	NAME_TAG,
	nameTagFor,
	sendTime,
	storeIncoming,
	storeOutgoing
} from './messaging.ts';

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

	// Regressão (2026-10-22): mensagens no mesmo segundo apareciam fora de ordem para os dois lados.
	it('várias mensagens no mesmo segundo aparecem na ordem em que foram enviadas', async () => {
		const alice = await device();
		const bob = await device();
		const conversationId = directConversationId(bob.publicKey);
		const now = Date.now();
		const texts = ['oi', 'tudo bem?', 'pode trazer o bolo', 'até já', 'tchau'];
		for (const text of texts) {
			const createdAt = sendTime(await alice.storage.conversations.get(conversationId), now);
			const w = alice.vault.wrapDirectMessage(bob.publicKey, text, [], 14, createdAt);
			await storeOutgoing(alice.storage, w.rumor, bob.publicKey);
			await storeIncoming(bob.storage, bob.publicKey, bob.vault.unwrap(w.toRecipient));
		}
		const mine = await alice.storage.messages.listByConversation(conversationId, 10);
		const theirs = await bob.storage.messages.listByConversation(directConversationId(alice.publicKey), 10);
		expect(mine.map((m) => m.text)).toEqual(texts);
		expect(theirs.map((m) => m.text)).toEqual(texts);
	});

	it('o horário de envio passa da última mensagem, mas no máximo um minuto à frente', () => {
		const now = 1_000_000_000;
		expect(sendTime(undefined, now)).toBe(1_000_000);
		expect(sendTime({ lastMessageAt: 999_000 }, now)).toBe(1_000_000);
		expect(sendTime({ lastMessageAt: 1_000_000 }, now)).toBe(1_000_001);
		// relógio de outra pessoa uma hora adiantado
		expect(sendTime({ lastMessageAt: 1_003_600 }, now)).toBe(1_000_060);
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
		expect(sent.conversation).toMatchObject({ lastMessagePreview: 'Áudio', lastMessageKind: 'audio' });

		const got = await storeIncoming(bob.storage, bob.publicKey, bob.vault.unwrap(wrapped.toRecipient));
		expect(got?.message).toMatchObject({ kind: 15, text: '', media });
	});

	it('áudio com silêncio no começo: o ponto de início vai na mensagem; valor estranho vira "toca inteiro"', async () => {
		const alice = await device();
		const bob = await device();
		const base = {
			ox: 'a'.repeat(64),
			x: 'b'.repeat(64),
			type: 'audio/webm;codecs=opus',
			size: 100,
			urls: ['https://um.example/' + 'b'.repeat(64)],
			key: 'c'.repeat(64),
			nonce: 'd'.repeat(24),
			duration: 10
		};
		const send = async (start: number | undefined, tags?: string[][]) => {
			const wrapped = alice.vault.wrapDirectMessage(bob.publicKey, base.urls[0], tags ?? mediaTags({ ...base, start }), 15);
			return (await storeIncoming(bob.storage, bob.publicKey, bob.vault.unwrap(wrapped.toRecipient)))?.message.media;
		};
		expect((await send(2.4))?.start).toBe(2.4);
		expect(mediaTags({ ...base }).some((t) => t[0] === 'start')).toBe(false); // sem início, sem tag
		// de quem escreveu: além da duração, negativo ou texto não valem
		for (const bad of ['10', '99', '-1', 'abc']) {
			const tags = [...mediaTags({ ...base }), ['start', bad]];
			expect((await send(undefined, tags))?.start).toBeUndefined();
		}
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

describe('apagar mensagens (RF-25)', () => {
	async function conversation() {
		const alice = await device();
		const bob = await device();
		const send = async (text: string) => {
			const w = alice.vault.wrapDirectMessage(bob.publicKey, text);
			await storeOutgoing(alice.storage, w.rumor, bob.publicKey);
			await storeIncoming(bob.storage, bob.publicKey, bob.vault.unwrap(w.toRecipient));
			return w.rumor.id;
		};
		return { alice, bob, send };
	}

	it('apagar para todos: o contato troca a mensagem pelo aviso, e a prévia acompanha', async () => {
		const { alice, bob, send } = await conversation();
		await send('primeira');
		const id = await send('mensagem errada');
		const mine = (await alice.storage.messages.get(id))!;
		await markDeleted(alice.storage, mine);
		const request = alice.vault.wrapDirectMessage(bob.publicKey, '', deletionTags(mine), 5);

		const got = await storeIncoming(bob.storage, bob.publicKey, bob.vault.unwrap(request.toRecipient));
		expect(got?.message).toMatchObject({ id, deleted: true, text: '' });
		const conv = await bob.storage.conversations.get(directConversationId(alice.publicKey));
		expect(conv?.lastMessagePreview).toBe('Mensagem apagada');
		expect((await alice.storage.messages.get(id))?.deleted).toBe(true);
	});

	it('o pedido de apagar só vale para mensagens de quem pediu', async () => {
		const { alice, bob, send } = await conversation();
		const fromAlice = await send('da Alice');
		// Bob escreve para a Alice e tenta apagar a mensagem dela no aparelho dela
		const fake = bob.vault.wrapDirectMessage(alice.publicKey, '', [['e', fromAlice]], 5);
		expect(await storeIncoming(alice.storage, alice.publicKey, alice.vault.unwrap(fake.toRecipient))).toBeUndefined();
		expect((await alice.storage.messages.get(fromAlice))?.deleted).toBeUndefined();
	});

	it('apagar para mim: some do aparelho e a prévia volta para a anterior', async () => {
		const { bob, send } = await conversation();
		await send('fica');
		const id = await send('some');
		await deleteForMe(bob.storage, id);
		expect(await bob.storage.messages.get(id)).toBeUndefined();
		const conv = (await bob.storage.conversations.listByRecent())[0];
		expect(conv.lastMessagePreview).toBe('fica');
	});

	it('arquivo em uso por outra mensagem não é apagado do aparelho', async () => {
		const { bob } = await conversation();
		const media = { ox: 'e'.repeat(64), x: 'f'.repeat(64), type: 'audio/ogg', size: 1, urls: ['https://x.example/f'], key: '0'.repeat(64), nonce: '0'.repeat(24) };
		await bob.storage.media.put({ ...media, file: new Blob(['x']), keep: false, lastAccess: 0 });
		const base = { conversationId: 'c', sender: 's', kind: 15, text: '', createdAt: 1, status: 'recebida' as const, media };
		await bob.storage.messages.put({ ...base, id: 'm1' });
		await bob.storage.messages.put({ ...base, id: 'm2', createdAt: 2 });
		await deleteForMe(bob.storage, 'm1');
		expect(await bob.storage.media.get(media.ox)).toBeDefined(); // m2 ainda usa
		await deleteForMe(bob.storage, 'm2');
		expect(await bob.storage.media.get(media.ox)).toBeUndefined();
	});
});
