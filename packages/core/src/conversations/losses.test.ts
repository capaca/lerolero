import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { KdfParams } from '../crypto/seal.ts';
import { createVault, RESEND_KIND, type Rumor } from '../identity/vault.ts';
import { openStorage } from '../storage/repositories.ts';
import { deliveryOf } from './interactions.ts';
import {
	ASK_AGAIN_S,
	GAP_WAIT_S,
	LOSS_DEADLINE_S,
	lostRecipients,
	markAsked,
	nextSeqTag,
	resendRequestsDue,
	resendsFor,
	resendTags,
	trackSeq
} from './losses.ts';
import { deleteForMe, directConversationId, markDeleted, storeIncoming, storeOutgoing } from './messaging.ts';

const FAST: KdfParams = { memoryKiB: 64, iterations: 1, parallelism: 1 };
const closers: Array<() => void> = [];
afterEach(() => closers.splice(0).forEach((c) => c()));

let n = 0;
async function person() {
	const vault = createVault({ kdf: FAST });
	const { publicKey } = await vault.create('123456');
	const storage = openStorage(`perdas-${n++}`);
	closers.push(() => storage.close());
	return { vault, publicKey, storage };
}
type Person = Awaited<ReturnType<typeof person>>;

async function befriend(a: Person, b: Person) {
	await a.storage.contacts.put({ publicKey: b.publicKey, state: 'aceito', dmRelays: [], addedAt: 0 });
	await b.storage.contacts.put({ publicKey: a.publicKey, state: 'aceito', dmRelays: [], addedAt: 0 });
}

/** `from` escreve para `to` com o próximo número; quem recebe só guarda se `deliver`. */
async function say(from: Person, to: Person, text: string, deliver = true) {
	const conversation = await from.storage.conversations.get(directConversationId(to.publicKey));
	const wrapped = from.vault.wrapDirectMessage(to.publicKey, text, nextSeqTag(conversation), 14);
	await storeOutgoing(from.storage, wrapped.rumor, to.publicKey);
	if (deliver) await storeIncoming(to.storage, to.publicKey, to.vault.unwrap(wrapped.toRecipient));
	return wrapped;
}

const now = () => Math.floor(Date.now() / 1000);

/** O pedido de reenvio que `from` faria a `to`, já aberto do lado de `to`. */
async function request(from: Person, to: Person, seqs: number[]): Promise<Rumor> {
	const tags = resendTags({ conversationId: directConversationId(to.publicKey), sender: to.publicKey, seqs });
	return to.vault.unwrap(from.vault.wrapDirectMessage(to.publicKey, '', tags, RESEND_KIND).toRecipient);
}

describe('numeração por conversa (RF-53)', () => {
	it('cada mensagem minha leva o número seguinte, e a minha cópia de outro aparelho acompanha a conta', async () => {
		const [alice, bob] = [await person(), await person()];
		const first = await say(alice, bob, 'um');
		const second = await say(alice, bob, 'dois');
		expect(first.rumor.tags).toContainEqual(['seq', '1']);
		expect(second.rumor.tags).toContainEqual(['seq', '2']);
		expect((await alice.storage.messages.get(second.rumor.id))?.rumor?.id).toBe(second.rumor.id);

		// o outro aparelho da Alice vê as cópias e continua do 3
		const other = { ...alice, storage: openStorage(`perdas-${n++}`) };
		closers.push(() => other.storage.close());
		await storeIncoming(other.storage, alice.publicKey, alice.vault.unwrap(second.toSelf));
		const conversation = await other.storage.conversations.get(directConversationId(bob.publicKey));
		expect(nextSeqTag(conversation)).toEqual([['seq', '3']]);
		expect((await other.storage.messages.get(second.rumor.id))?.rumor?.id).toBe(second.rumor.id);
	});

	it('um buraco vira pedido depois da janela; quem enviou reenvia o mesmo rumor e o buraco fecha', async () => {
		const [alice, bob] = [await person(), await person()];
		await befriend(alice, bob);
		await say(alice, bob, 'um');
		const lost = await say(alice, bob, 'dois', false);
		await say(alice, bob, 'três');

		// ainda dentro da janela: pode estar só atrasada
		expect(await resendRequestsDue(bob.storage, now())).toEqual([]);
		const [due] = await resendRequestsDue(bob.storage, now() + GAP_WAIT_S);
		expect(due).toEqual({ conversationId: directConversationId(alice.publicKey), sender: alice.publicKey, seqs: [2] });

		// pedido feito: só pede de novo um dia depois
		await markAsked(bob.storage, due, now() + GAP_WAIT_S);
		expect(await resendRequestsDue(bob.storage, now() + GAP_WAIT_S + 60)).toEqual([]);
		expect(await resendRequestsDue(bob.storage, now() + GAP_WAIT_S + ASK_AGAIN_S)).toHaveLength(1);

		// a Alice acha a mensagem 2 e reenvia o mesmo rumor
		const resends = await resendsFor(alice.storage, alice.publicKey, await request(bob, alice, [2]));
		expect(resends.map((r) => r.id)).toEqual([lost.rumor.id]);
		const [{ wrap }] = alice.vault.rewrap(resends[0], [bob.publicKey]);
		const stored = await storeIncoming(bob.storage, bob.publicKey, bob.vault.unwrap(wrap));
		expect(stored?.message).toMatchObject({ id: lost.rumor.id, text: 'dois' });
		expect(await resendRequestsDue(bob.storage, now() + 2 * ASK_AGAIN_S)).toEqual([]);
	});

	it('não pede reenvio a quem ainda é só um pedido de mensagem (RF-12)', async () => {
		const [alice, bob] = [await person(), await person()];
		await say(alice, bob, 'um');
		await say(alice, bob, 'dois', false);
		await say(alice, bob, 'três');
		expect((await bob.storage.contacts.get(alice.publicKey))?.state).toBe('pedido');
		expect(await resendRequestsDue(bob.storage, now() + GAP_WAIT_S)).toEqual([]);
	});

	it('o primeiro número visto não cria buraco, e um salto enorme guarda só os 50 mais próximos', () => {
		const first = trackSeq(undefined, 'a', 40, 0);
		expect(first.a).toEqual({ top: 40, missing: [] });
		const jump = trackSeq(first, 'a', 1000, 0);
		expect(jump.a.missing.map((m) => m.n)).toEqual(Array.from({ length: 50 }, (_, i) => 950 + i));
		// a que faltava chegou
		expect(trackSeq(jump, 'a', 960, 0).a.missing).toHaveLength(49);
	});

	it('não reenvia o que eu apaguei, nem para quem não estava na mensagem, nem a quem bloqueei', async () => {
		const [alice, bob, carol] = [await person(), await person(), await person()];
		await befriend(alice, bob);
		await befriend(alice, carol);
		const one = await say(alice, bob, 'um', false);
		const two = await say(alice, bob, 'dois', false);
		await markDeleted(alice.storage, (await alice.storage.messages.get(one.rumor.id))!);
		await deleteForMe(alice.storage, two.rumor.id);
		expect(await resendsFor(alice.storage, alice.publicKey, await request(bob, alice, [1, 2]))).toEqual([]);

		// a Carol pede os números da conversa dela, onde não há nada da Alice para ela
		await say(alice, bob, 'três', false);
		expect(await resendsFor(alice.storage, alice.publicKey, await request(carol, alice, [3]))).toEqual([]);

		await alice.storage.contacts.put({ publicKey: bob.publicKey, state: 'bloqueado', dmRelays: [], addedAt: 0 });
		expect(await resendsFor(alice.storage, alice.publicKey, await request(bob, alice, [3]))).toEqual([]);
	});

	it('o cofre não embrulha de novo a minha mensagem para quem não estava nela', async () => {
		const [alice, bob, carol] = [await person(), await person(), await person()];
		const sent = await say(alice, bob, 'só para o Bob', false);
		expect(alice.vault.rewrap(sent.rumor, [bob.publicKey])).toHaveLength(1);
		expect(() => alice.vault.rewrap(sent.rumor, [carol.publicKey])).toThrow('destinatário fora da mensagem');
	});
});

describe('prazo de quem enviou (RF-53)', () => {
	const rumor = { id: 'x', pubkey: 'eu', kind: 14, content: 'oi', created_at: 1_000, tags: [['p', 'a'], ['p', 'b']] };
	const message = { status: 'enviada' as const, rumor };

	it('sem confirmação em 7 dias, "possivelmente perdida" para quem não confirmou; o reenvio recomeça o prazo', () => {
		const late = 1_000 + LOSS_DEADLINE_S;
		expect(deliveryOf(message, ['a'], late - 1)).toBe('enviada');
		expect(deliveryOf(message, ['a'], late)).toBe('perdida');
		expect(lostRecipients({ ...message, receipts: { a: 'entregue' } }, ['a', 'b'], late)).toEqual(['b']);
		expect(deliveryOf({ ...message, receipts: { a: 'entregue', b: 'lida' } }, ['a', 'b'], late)).toBe('entregue');
		expect(deliveryOf({ ...message, resentAt: late - 10 }, ['a'], late)).toBe('enviada');
	});

	it('quem entrou no grupo depois não conta, e mensagem sem o rumor (de antes) nunca fica perdida', () => {
		const late = 1_000 + LOSS_DEADLINE_S;
		expect(lostRecipients({ ...message, receipts: { a: 'lida', b: 'lida' } }, ['a', 'b', 'novo'], late)).toEqual([]);
		expect(deliveryOf({ status: 'enviada' }, ['a'], late)).toBe('enviada');
	});
});
