import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { getPow } from 'nostr-tools/nip13';
import { getEventHash, verifyEvent } from 'nostr-tools/pure';
import type { KdfParams } from './seal.ts';
import { createVault } from '../identity/vault.ts';
import { directConversationId, needsProof, storeIncoming, storeOutgoing } from '../conversations/messaging.ts';
import { openStorage } from '../storage/repositories.ts';
import { mine, powOf } from './pow.ts';

const FAST: KdfParams = { memoryKiB: 64, iterations: 1, parallelism: 1 };
const closers: Array<() => void> = [];
afterEach(() => closers.splice(0).forEach((c) => c()));

let n = 0;
async function person() {
	const vault = createVault({ kdf: FAST });
	const { publicKey } = await vault.create('123456');
	const storage = openStorage(`prova-${n++}`);
	closers.push(() => storage.close());
	return { vault, publicKey, storage };
}

describe('prova de trabalho (RF-90, NIP-13)', () => {
	it('acha o nonce sem mexer no horário, e o id confere com a contagem do NIP-13', async () => {
		const event = { kind: 1059, created_at: 1_700_000_000, tags: [['p', 'a'.repeat(64)]], content: 'conteúdo+/=', pubkey: 'b'.repeat(64) };
		const tags = await mine(event, 10);
		expect(tags.at(-1)).toEqual(['nonce', expect.stringMatching(/^\d+$/), '10']);
		const id = getEventHash({ ...event, tags });
		expect(powOf(id)).toBeGreaterThanOrEqual(10);
		expect(powOf(id)).toBe(getPow(id));
		expect(powOf('0'.repeat(64))).toBe(256);
	});

	it('o embrulho com prova abre normalmente para quem recebe, com horário sorteado', async () => {
		const [ana, bia] = await Promise.all([person(), person()]);
		const { rumor } = ana.vault.wrapDirectMessage(bia.publicKey, 'oi, Bia');
		const proved = await ana.vault.proveWrap(rumor, bia.publicKey, 10);
		expect(verifyEvent(proved)).toBe(true);
		expect(powOf(proved.id)).toBeGreaterThanOrEqual(10);
		expect(proved.created_at).toBeLessThanOrEqual(Math.round(Date.now() / 1000));
		expect(proved.created_at).toBeGreaterThan(Date.now() / 1000 - 2 * 24 * 3600 - 5);
		expect(bia.vault.unwrap(proved)).toMatchObject({ id: rumor.id, content: 'oi, Bia' });
	});

	it('o cofre só embrulha de novo rumor meu, para quem está nele', async () => {
		const [ana, bia, caio] = await Promise.all([person(), person(), person()]);
		const fromBia = bia.vault.wrapDirectMessage(ana.publicKey, 'oi').rumor;
		await expect(ana.vault.proveWrap(fromBia, caio.publicKey, 4)).rejects.toThrow();
		const mine = ana.vault.wrapDirectMessage(bia.publicKey, 'oi').rumor;
		await expect(ana.vault.proveWrap(mine, caio.publicKey, 4)).rejects.toThrow();
		await expect(ana.vault.proveWrap({ ...mine, content: 'outro' }, bia.publicKey, 4)).rejects.toThrow();
	});

	it('precisa de prova até a pessoa me escrever; conversa antiga é conferida nas mensagens', async () => {
		const [ana, bia] = await Promise.all([person(), person()]);
		expect(await needsProof(ana.storage, bia.publicKey)).toBe(true);
		await storeOutgoing(ana.storage, ana.vault.wrapDirectMessage(bia.publicKey, 'oi').rumor, bia.publicKey);
		expect(await needsProof(ana.storage, bia.publicKey)).toBe(true);

		const reply = bia.vault.wrapDirectMessage(ana.publicKey, 'oi, Ana');
		await storeIncoming(ana.storage, ana.publicKey, ana.vault.unwrap(reply.toRecipient));
		expect(await needsProof(ana.storage, bia.publicKey)).toBe(false);

		// conversa de antes da marca: a resposta está nas mensagens; a marca passa a valer
		const id = directConversationId(bia.publicKey);
		const { heardFrom: _, ...old } = (await ana.storage.conversations.get(id))!;
		await ana.storage.conversations.put(old);
		expect(await needsProof(ana.storage, bia.publicKey)).toBe(false);
		expect((await ana.storage.conversations.get(id))?.heardFrom).toBe(true);
	});
});
