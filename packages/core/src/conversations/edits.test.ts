import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { KdfParams } from '../crypto/seal.ts';
import { createVault, EDIT_KIND } from '../identity/vault.ts';
import { openStorage } from '../storage/repositories.ts';
import { canEdit, EDIT_WINDOW_S, editMine, editTags, storeEdit } from './edits.ts';
import { directConversationId, storeIncoming, storeOutgoing } from './messaging.ts';
import { mentionedIn, mentionOf, splitMentions, withMentionLabels } from './mentions.ts';

const FAST: KdfParams = { memoryKiB: 64, iterations: 1, parallelism: 1 };
const closers: Array<() => void> = [];
afterEach(() => closers.splice(0).forEach((c) => c()));

let n = 0;
async function device() {
	const vault = createVault({ kdf: FAST });
	const { publicKey } = await vault.create('123456');
	const storage = openStorage(`edicao-${n++}`);
	closers.push(() => storage.close());
	return { vault, publicKey, storage };
}
type Person = Awaited<ReturnType<typeof device>>;

const T0 = 1_800_000_000;

/** Alice manda "oi" a Bob, que recebe. */
async function conversa() {
	const alice = await device();
	const bob = await device();
	await bob.storage.contacts.put({ publicKey: alice.publicKey, state: 'aceito', dmRelays: [], addedAt: 1 });
	const w = alice.vault.wrapDirectMessage(bob.publicKey, 'oi, tudo bme?', [], 14, T0);
	await storeOutgoing(alice.storage, w.rumor, bob.publicKey);
	await storeIncoming(bob.storage, bob.publicKey, bob.vault.unwrap(w.toRecipient));
	return { alice, bob, id: w.rumor.id };
}

function edicao(from: Person, to: Person, id: string, text: string, at: number) {
	return to.vault.unwrap(from.vault.wrapDirectMessage(to.publicKey, text, editTags({ id }), EDIT_KIND, at).toRecipient);
}

describe('editar mensagem (RF-24)', () => {
	it('quem recebe vê o texto novo marcado como editado, também na prévia da lista', async () => {
		const { alice, bob, id } = await conversa();
		await storeEdit(bob.storage, bob.publicKey, edicao(alice, bob, id, 'oi, tudo bem?', T0 + 60));
		expect(await bob.storage.messages.get(id)).toMatchObject({ text: 'oi, tudo bem?', editedAt: T0 + 60 });
		expect((await bob.storage.conversations.get(directConversationId(alice.publicKey)))?.lastMessagePreview).toBe('oi, tudo bem?');
	});

	it('só quem escreveu edita: a edição de outra pessoa é ignorada', async () => {
		const { bob, id } = await conversa();
		const carol = await device();
		await bob.storage.contacts.put({ publicKey: carol.publicKey, state: 'aceito', dmRelays: [], addedAt: 1 });
		await storeEdit(bob.storage, bob.publicKey, edicao(carol, bob, id, 'mensagem falsa', T0 + 60));
		expect((await bob.storage.messages.get(id))?.text).toBe('oi, tudo bme?');
	});

	it('depois de 15 minutos não vale, e a edição mais velha não desfaz a mais nova', async () => {
		const { alice, bob, id } = await conversa();
		await storeEdit(bob.storage, bob.publicKey, edicao(alice, bob, id, 'tarde demais', T0 + EDIT_WINDOW_S + 120));
		expect((await bob.storage.messages.get(id))?.text).toBe('oi, tudo bme?');
		await storeEdit(bob.storage, bob.publicKey, edicao(alice, bob, id, 'segunda', T0 + 200));
		await storeEdit(bob.storage, bob.publicKey, edicao(alice, bob, id, 'primeira', T0 + 100));
		expect((await bob.storage.messages.get(id))?.text).toBe('segunda');
	});

	it('a edição que chega antes da mensagem espera por ela', async () => {
		const alice = await device();
		const bob = await device();
		await bob.storage.contacts.put({ publicKey: alice.publicKey, state: 'aceito', dmRelays: [], addedAt: 1 });
		await bob.storage.conversations.put({ id: directConversationId(alice.publicKey), type: 'direta', members: [alice.publicKey], lastMessageAt: 0, unread: 0 });
		const w = alice.vault.wrapDirectMessage(bob.publicKey, 'oi', [], 14, T0);
		await storeEdit(bob.storage, bob.publicKey, edicao(alice, bob, w.rumor.id, 'olá', T0 + 30));
		const got = await storeIncoming(bob.storage, bob.publicKey, bob.vault.unwrap(w.toRecipient));
		expect(got?.message).toMatchObject({ text: 'olá', editedAt: T0 + 30 });
	});

	it('eu só edito texto meu, no prazo; a edição aparece na hora', async () => {
		const { alice, bob, id } = await conversa();
		const minha = (await alice.storage.messages.get(id))!;
		expect(canEdit(minha, alice.publicKey, (T0 + 60) * 1000)).toBe(true);
		expect(canEdit(minha, bob.publicKey, (T0 + 60) * 1000)).toBe(false);
		expect(canEdit(minha, alice.publicKey, (T0 + EDIT_WINDOW_S + 1) * 1000)).toBe(false);
		const editada = await editMine(alice.storage, alice.publicKey, id, 'oi, tudo bem?', (T0 + 60) * 1000);
		expect(editada).toMatchObject({ text: 'oi, tudo bem?', editedAt: T0 + 60 });
		await expect(editMine(alice.storage, alice.publicKey, id, 'de novo', (T0 + EDIT_WINDOW_S + 1) * 1000)).rejects.toThrow();
	});
});

describe('menções (RF-35)', () => {
	it('a menção leva a chave e cada um mostra o nome que conhece', async () => {
		const ana = (await device()).publicKey;
		const text = `bom dia ${mentionOf(ana)}, tudo certo?`;
		expect(mentionedIn(text)).toEqual([ana]);
		expect(splitMentions(text)).toEqual([{ text: 'bom dia ' }, { text: mentionOf(ana), mention: ana }, { text: ', tudo certo?' }]);
		expect(withMentionLabels(text, () => '@Ana')).toBe('bom dia @Ana, tudo certo?');
	});

	it('npub inválido fica como texto', () => {
		const text = 'olha nostr:npub1' + 'q'.repeat(58);
		expect(splitMentions(text)).toEqual([{ text }]);
	});
});

describe('prévia com menção', () => {
	it('a prévia da lista não parte a menção ao meio', async () => {
		const { summaryOf, PREVIEW_LENGTH } = await import('../storage/summary.ts');
		const ana = (await device()).publicKey;
		const text = `${'a'.repeat(PREVIEW_LENGTH - 5)} ${mentionOf(ana)} fim`;
		const preview = summaryOf({ text, sender: ana }).lastMessagePreview!;
		expect(preview).toBe('a'.repeat(PREVIEW_LENGTH - 5) + ' ');
		expect(summaryOf({ text: `oi ${mentionOf(ana)}!`, sender: ana }).lastMessagePreview).toBe(`oi ${mentionOf(ana)}!`);
	});
});
