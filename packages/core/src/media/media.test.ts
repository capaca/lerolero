import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { KdfParams } from '../crypto/seal.ts';
import { createVault } from '../identity/vault.ts';
import { openStorage } from '../storage/repositories.ts';
import { FakeBlossom } from '../testing/fake-blossom.ts';
import { BlossomError, remove } from './blossom.ts';
import { decryptFile, encryptFile, MediaIntegrityError } from './crypto.ts';
import { openMedia, prepareMedia } from './media.ts';

const FAST: KdfParams = { memoryKiB: 64, iterations: 1, parallelism: 1 };
const cleanup: Array<() => unknown> = [];
afterEach(async () => {
	for (const fn of cleanup.splice(0).reverse()) await fn();
});

let n = 0;
async function setup(servers = 3) {
	const vault = createVault({ kdf: FAST });
	await vault.create('123456');
	const storage = openStorage(`midia-${n++}`);
	const blossoms = await Promise.all(Array.from({ length: servers }, () => new FakeBlossom().start()));
	cleanup.push(() => storage.close(), ...blossoms.map((b) => () => b.stop()));
	const signer = async (t: Parameters<typeof vault.sign>[0]) => vault.sign(t);
	return { storage, blossoms, signer, servers: blossoms.map((b) => b.url) };
}

const audio = () => new Blob([crypto.getRandomValues(new Uint8Array(3000))], { type: 'audio/webm;codecs=opus' });

describe('cifra de mídia', () => {
	it('cifra e decifra conferindo os hashes', async () => {
		const data = crypto.getRandomValues(new Uint8Array(1000));
		const enc = await encryptFile(data);
		expect(enc.encrypted).not.toEqual(data);
		expect(await decryptFile(enc.encrypted, enc)).toEqual(data);
	});

	it('percebe arquivo trocado pelo servidor', async () => {
		const enc = await encryptFile(crypto.getRandomValues(new Uint8Array(100)));
		const tampered = enc.encrypted.map((b) => b ^ 1);
		await expect(decryptFile(tampered, enc)).rejects.toBeInstanceOf(MediaIntegrityError);
	});
});

describe('envio e recebimento pelo Blossom', () => {
	it('envia para 2 servidores e quem recebe abre o arquivo original', async () => {
		const sender = await setup();
		const file = audio();
		const ref = await prepareMedia(sender.storage, file, { servers: sender.servers, signer: sender.signer });
		expect(ref.urls).toHaveLength(2);
		expect(sender.blossoms[2].uploads).toBe(0); // o terceiro só seria usado se um dos dois falhasse

		const receiverStorage = openStorage(`midia-${n++}`);
		cleanup.push(() => receiverStorage.close());
		const opened = await openMedia(receiverStorage, ref);
		expect(new Uint8Array(await opened.arrayBuffer())).toEqual(new Uint8Array(await file.arrayBuffer()));
		expect(opened.type).toBe('audio/webm;codecs=opus');
	});

	it('pula o servidor que recusa e usa a reserva', async () => {
		const s = await setup();
		s.blossoms[0].rejectUploads = true;
		const ref = await prepareMedia(s.storage, audio(), { servers: s.servers, signer: s.signer });
		expect(ref.urls.map((u) => new URL(u).origin)).toEqual([s.servers[1], s.servers[2]]);
	});

	it('falha com erro claro se nenhum servidor aceita', async () => {
		const s = await setup(2);
		s.blossoms.forEach((b) => (b.rejectUploads = true));
		await expect(prepareMedia(s.storage, audio(), { servers: s.servers, signer: s.signer })).rejects.toBeInstanceOf(BlossomError);
	});

	it('o mesmo arquivo não é enviado de novo (RF-70)', async () => {
		const s = await setup();
		const file = audio();
		const first = await prepareMedia(s.storage, file, { servers: s.servers, signer: s.signer });
		const again = await prepareMedia(s.storage, file, { servers: s.servers, signer: s.signer });
		expect(again).toEqual(first);
		expect(s.blossoms.reduce((sum, b) => sum + b.uploads, 0)).toBe(2);
	});

	it('baixa do segundo servidor se o primeiro adulterar ou cair', async () => {
		const s = await setup();
		const ref = await prepareMedia(s.storage, audio(), { servers: s.servers, signer: s.signer });
		const other = openStorage(`midia-${n++}`);
		cleanup.push(() => other.close());
		await s.blossoms[0].stop();
		expect(await openMedia(other, ref)).toBeInstanceOf(Blob);
	});

	it('recusa arquivo adulterado (e não guarda nada)', async () => {
		const s = await setup(2);
		const ref = await prepareMedia(s.storage, audio(), { servers: s.servers, signer: s.signer });
		s.blossoms.forEach((b) => (b.tamper = true));
		const other = openStorage(`midia-${n++}`);
		cleanup.push(() => other.close());
		await expect(openMedia(other, ref)).rejects.toBeInstanceOf(MediaIntegrityError);
		expect(await other.media.get(ref.ox)).toBeUndefined();
	});

	it('a segunda abertura vem do aparelho, sem baixar de novo', async () => {
		const s = await setup();
		const ref = await prepareMedia(s.storage, audio(), { servers: s.servers, signer: s.signer });
		const other = openStorage(`midia-${n++}`);
		cleanup.push(() => other.close());
		await openMedia(other, ref);
		s.blossoms.forEach((b) => (b.tamper = true)); // se baixasse de novo, falharia
		expect(await openMedia(other, ref)).toBeInstanceOf(Blob);
	});

	it('quem enviou consegue remover o arquivo dos servidores', async () => {
		const s = await setup();
		const ref = await prepareMedia(s.storage, audio(), { servers: s.servers, signer: s.signer });
		const removed = await remove(ref.urls, ref.x, s.signer);
		expect(removed).toHaveLength(2);
		expect(s.blossoms.every((b) => !b.files.has(ref.x))).toBe(true);
	});
});
