import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { KdfParams } from '../crypto/seal.ts';
import { createVault, RECEIPT_KIND, REACTION_KIND } from '../identity/vault.ts';
import { openStorage } from '../storage/repositories.ts';
import {
	deliveryOf,
	markAcknowledged,
	reactionTags,
	receiptsDue,
	removeReactions,
	replyTags,
	storeReaction,
	storeReceipt
} from './interactions.ts';
import { deletionTags, deleteForMe, directConversationId, markDeleted, storeIncoming, storeOutgoing } from './messaging.ts';

const FAST: KdfParams = { memoryKiB: 64, iterations: 1, parallelism: 1 };
const closers: Array<() => void> = [];
afterEach(() => closers.splice(0).forEach((c) => c()));

let n = 0;
async function person() {
	const vault = createVault({ kdf: FAST });
	const { publicKey } = await vault.create('123456');
	const storage = openStorage(`interacoes-${n++}`);
	closers.push(() => storage.close());
	return { vault, publicKey, storage };
}
type Person = Awaited<ReturnType<typeof person>>;

async function befriend(a: Person, b: Person) {
	await a.storage.contacts.put({ publicKey: b.publicKey, state: 'aceito', dmRelays: [], addedAt: 0 });
	await b.storage.contacts.put({ publicKey: a.publicKey, state: 'aceito', dmRelays: [], addedAt: 0 });
}

/** `from` escreve para `to`; as duas pontas guardam a mensagem. */
async function say(from: Person, to: Person, text: string, tags: string[][] = [], at?: number) {
	const wrapped = from.vault.wrapDirectMessage(to.publicKey, text, tags, 14, at);
	await storeOutgoing(from.storage, wrapped.rumor, to.publicKey);
	const got = await storeIncoming(to.storage, to.publicKey, to.vault.unwrap(wrapped.toRecipient));
	return { id: wrapped.rumor.id, got: got!.message };
}

describe('respostas (RF-22)', () => {
	it('a resposta guarda a mensagem citada nas duas pontas', async () => {
		const [alice, bob] = [await person(), await person()];
		const first = await say(alice, bob, 'vamos jantar?');
		const second = await say(bob, alice, 'vamos!', replyTags(first.id));
		expect(second.got.replyTo).toBe(first.id);
		expect((await bob.storage.messages.get(second.id))?.replyTo).toBe(first.id);
	});
});

describe('reações (RF-23)', () => {
	it('uma reação por pessoa: a mais nova substitui a anterior, e a mais velha que chega depois é ignorada', async () => {
		const [alice, bob] = [await person(), await person()];
		await befriend(alice, bob);
		const msg = await say(alice, bob, 'oi');
		const react = async (emoji: string, at: number) => {
			const wrapped = bob.vault.wrapDirectMessage(alice.publicKey, emoji, reactionTags({ id: msg.id, kind: 14 }), REACTION_KIND, at);
			return { id: wrapped.rumor.id, stored: await storeReaction(alice.storage, alice.publicKey, alice.vault.unwrap(wrapped.toRecipient)) };
		};
		const first = await react('👍', 1000);
		expect(first.stored).toBe(true);
		expect((await react('❤️', 2000)).stored).toBe(true);
		expect((await react('😂', 1500)).stored).toBe(false); // chegou fora de ordem
		const list = await alice.storage.reactions.listByConversation(directConversationId(bob.publicKey));
		expect(list.map((r) => r.emoji)).toEqual(['❤️']);
	});

	it('desfazer: o pedido de apagar vale só de quem reagiu', async () => {
		const [alice, bob, carol] = [await person(), await person(), await person()];
		await befriend(alice, bob);
		const msg = await say(alice, bob, 'oi');
		const wrapped = bob.vault.wrapDirectMessage(alice.publicKey, '👍', reactionTags({ id: msg.id, kind: 14 }), REACTION_KIND);
		await storeReaction(alice.storage, alice.publicKey, alice.vault.unwrap(wrapped.toRecipient));

		const forged = carol.vault.wrapDirectMessage(alice.publicKey, '', [['e', wrapped.rumor.id]], 5);
		expect(await removeReactions(alice.storage, alice.vault.unwrap(forged.toRecipient))).toBe(false);
		const undo = bob.vault.wrapDirectMessage(alice.publicKey, '', [['e', wrapped.rumor.id]], 5);
		expect(await removeReactions(alice.storage, alice.vault.unwrap(undo.toRecipient))).toBe(true);
		expect(await alice.storage.reactions.get(wrapped.rumor.id)).toBeUndefined();
	});

	it('reação de quem não tem conversa comigo não é guardada, nem a de bloqueado', async () => {
		const [alice, bob, carol] = [await person(), await person(), await person()];
		await befriend(alice, bob);
		const msg = await say(alice, bob, 'oi');
		const stranger = carol.vault.wrapDirectMessage(alice.publicKey, '👍', reactionTags({ id: msg.id, kind: 14 }), REACTION_KIND);
		expect(await storeReaction(alice.storage, alice.publicKey, alice.vault.unwrap(stranger.toRecipient))).toBe(false);
		await alice.storage.contacts.put({ publicKey: bob.publicKey, state: 'bloqueado', dmRelays: [], addedAt: 0 });
		const blocked = bob.vault.wrapDirectMessage(alice.publicKey, '👍', reactionTags({ id: msg.id, kind: 14 }), REACTION_KIND);
		expect(await storeReaction(alice.storage, alice.publicKey, alice.vault.unwrap(blocked.toRecipient))).toBe(false);
	});

	it('apagar a mensagem leva as reações junto', async () => {
		const [alice, bob] = [await person(), await person()];
		await befriend(alice, bob);
		const msg = await say(alice, bob, 'oi');
		const wrapped = bob.vault.wrapDirectMessage(alice.publicKey, '👍', reactionTags({ id: msg.id, kind: 14 }), REACTION_KIND);
		await storeReaction(alice.storage, alice.publicKey, alice.vault.unwrap(wrapped.toRecipient));
		await markDeleted(alice.storage, (await alice.storage.messages.get(msg.id))!);
		expect(await alice.storage.reactions.listByConversation(directConversationId(bob.publicKey))).toEqual([]);
		expect(deletionTags({ id: msg.id, kind: 14 } as never)).toBeTruthy();
		await deleteForMe(alice.storage, msg.id);
	});

	it('o cofre recusa reação sem a mensagem ou com texto longo', async () => {
		const alice = await person();
		const bob = await person();
		expect(() => alice.vault.wrapDirectMessage(bob.publicKey, '👍', [], REACTION_KIND)).toThrow();
		expect(() => alice.vault.wrapDirectMessage(bob.publicKey, 'x'.repeat(40), [['e', 'a'.repeat(64)]], REACTION_KIND)).toThrow();
	});
});

describe('confirmações de entrega e leitura (RF-50, 51)', () => {
	const confirm = (from: Person, to: Person, ids: string[], status: 'entregue' | 'lida') =>
		from.vault.wrapDirectMessage(to.publicKey, '', [...ids.map((id) => ['e', id]), ['status', status]], RECEIPT_KIND);

	it('entregue e lida chegam ao remetente, e uma lida não volta a entregue', async () => {
		const [alice, bob] = [await person(), await person()];
		const msg = await say(alice, bob, 'oi');
		const read = (w: ReturnType<typeof confirm>, readReceipts = true) =>
			storeReceipt(alice.storage, alice.publicKey, alice.vault.unwrap(w.toRecipient), { readReceipts });
		expect(await read(confirm(bob, alice, [msg.id], 'entregue'))).toBe(true);
		expect((await alice.storage.messages.get(msg.id))?.receipts).toEqual({ [bob.publicKey]: 'entregue' });
		expect(await read(confirm(bob, alice, [msg.id], 'lida'))).toBe(true);
		expect(await read(confirm(bob, alice, [msg.id], 'entregue'))).toBe(false);
		expect((await alice.storage.messages.get(msg.id))?.receipts).toEqual({ [bob.publicKey]: 'lida' });
	});

	it('com a confirmação de leitura desligada, a "lida" dos outros vale só como entregue', async () => {
		const [alice, bob] = [await person(), await person()];
		const msg = await say(alice, bob, 'oi');
		const w = confirm(bob, alice, [msg.id], 'lida');
		await storeReceipt(alice.storage, alice.publicKey, alice.vault.unwrap(w.toRecipient), { readReceipts: false });
		expect((await alice.storage.messages.get(msg.id))?.receipts).toEqual({ [bob.publicKey]: 'entregue' });
	});

	it('quem não está na conversa não confirma, nem a mensagem dos outros', async () => {
		const [alice, bob, carol] = [await person(), await person(), await person()];
		const mine = await say(alice, bob, 'oi');
		const theirs = await say(bob, alice, 'olá');
		const options = { readReceipts: true };
		const fromStranger = confirm(carol, alice, [mine.id], 'lida');
		expect(await storeReceipt(alice.storage, alice.publicKey, alice.vault.unwrap(fromStranger.toRecipient), options)).toBe(false);
		const forOthers = confirm(bob, alice, [theirs.id], 'lida');
		expect(await storeReceipt(alice.storage, alice.publicKey, alice.vault.unwrap(forOthers.toRecipient), options)).toBe(false);
	});

	it('o estado mostrado é o do destinatário mais atrasado', () => {
		const base = { status: 'enviada' as const };
		expect(deliveryOf({ status: 'pendente' }, ['a'])).toBe('pendente');
		expect(deliveryOf(base, ['a'])).toBe('enviada');
		expect(deliveryOf({ ...base, receipts: { a: 'entregue' } }, ['a'])).toBe('entregue');
		expect(deliveryOf({ ...base, receipts: { a: 'lida' } }, ['a'])).toBe('lida');
		expect(deliveryOf({ ...base, receipts: { a: 'lida' } }, ['a', 'b'])).toBe('enviada');
		expect(deliveryOf({ ...base, receipts: { a: 'lida', b: 'entregue' } }, ['a', 'b'])).toBe('entregue');
		expect(deliveryOf({ ...base, receipts: { a: 'lida', b: 'lida' } }, ['a', 'b'])).toBe('lida');
	});

	it('só confirmo a contato; pedido de mensagem não ganha sinal de que estou aqui', async () => {
		const [alice, bob] = [await person(), await person()];
		const msg = await say(bob, alice, 'oi, sou eu');
		// para Alice, Bob é pedido
		expect((await alice.storage.contacts.get(bob.publicKey))?.state).toBe('pedido');
		expect((await receiptsDue(alice.storage, alice.publicKey, [msg.id], 'entregue')).size).toBe(0);
		await alice.storage.contacts.put({ publicKey: bob.publicKey, state: 'aceito', dmRelays: [], addedAt: 0 });
		const due = await receiptsDue(alice.storage, alice.publicKey, [msg.id], 'entregue');
		expect(due.get(bob.publicKey)).toEqual([msg.id]);
		await markAcknowledged(alice.storage, [msg.id], 'entregue');
		expect((await receiptsDue(alice.storage, alice.publicKey, [msg.id], 'entregue')).size).toBe(0);
		expect((await receiptsDue(alice.storage, alice.publicKey, [msg.id], 'lida')).size).toBe(1);
	});
});
