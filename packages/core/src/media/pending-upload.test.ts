import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { KdfParams } from '../crypto/seal.ts';
import { createVault } from '../identity/vault.ts';
import type { MessageRecord } from '../storage/records.ts';
import { openStorage } from '../storage/repositories.ts';
import { FakeBlossom } from '../testing/fake-blossom.ts';
import { openMedia } from './media.ts';
import {
	discardPendingUpload,
	listPendingUploads,
	retryPendingUpload,
	startPendingAudio,
	tryPendingUpload,
	uploadRetryDelay,
	UPLOAD_GIVE_UP_MS
} from './pending-upload.ts';

const FAST: KdfParams = { memoryKiB: 64, iterations: 1, parallelism: 1 };
const cleanup: Array<() => unknown> = [];
afterEach(async () => {
	for (const fn of cleanup.splice(0).reverse()) await fn();
});

const ME = 'a'.repeat(64);
const FRIEND = 'b'.repeat(64);
const CONVERSATION = `direta:${FRIEND}`;

let n = 0;
async function setup() {
	const vault = createVault({ kdf: FAST });
	await vault.create('123456');
	const storage = openStorage(`envio-pendente-${n++}`);
	const blossoms = await Promise.all([0, 1].map(() => new FakeBlossom().start()));
	cleanup.push(() => storage.close(), ...blossoms.map((b) => () => b.stop()));
	const sent: Array<{ x: string; urls: string[]; duration?: number }> = [];
	const deps = (overrides: Partial<Parameters<typeof tryPendingUpload>[2]> = {}) => ({
		servers: blossoms.map((b) => b.url),
		signer: async (t: Parameters<typeof vault.sign>[0]) => vault.sign(t),
		// como o app: a mensagem de verdade é guardada com o mesmo arquivo (mesmo `ox`)
		send: async (media: Parameters<Parameters<typeof tryPendingUpload>[2]['send']>[0]) => {
			sent.push(media);
			const real: MessageRecord = { id: `real-${sent.length}`, conversationId: CONVERSATION, sender: ME, kind: 15, text: '', createdAt: 1, status: 'pendente', media };
			await storage.messages.put(real);
		},
		...overrides
	});
	return { storage, blossoms, sent, deps };
}

const audio = () => new Blob([crypto.getRandomValues(new Uint8Array(3000))], { type: 'audio/webm;codecs=opus' });
const start = (storage: Awaited<ReturnType<typeof setup>>['storage'], now = 1_000_000) =>
	startPendingAudio(storage, { conversationId: CONVERSATION, me: ME, file: audio(), duration: 4, now });

describe('espera entre tentativas', () => {
	it('dobra a cada falha, com teto, e o sorteio fica entre a metade e o total', () => {
		expect([1, 2, 3, 4, 5, 6, 9].map((a) => uploadRetryDelay(a, () => 1))).toEqual([2000, 4000, 8000, 16000, 32000, 60000, 60000]);
		expect([1, 3, 6].map((a) => uploadRetryDelay(a, () => 0))).toEqual([1000, 4000, 30000]);
		for (let i = 0; i < 50; i++) {
			const d = uploadRetryDelay(4);
			expect(d).toBeGreaterThanOrEqual(8000);
			expect(d).toBeLessThanOrEqual(16000);
		}
	});
});

describe('áudio que sobe por trás do balão', () => {
	it('mostra o balão na hora, tocável pelo arquivo do aparelho', async () => {
		const { storage } = await setup();
		const message = await start(storage);
		expect(message.id.startsWith('envio:')).toBe(true);
		expect(message.status).toBe('pendente');
		expect((await storage.messages.listByConversation(CONVERSATION, 10)).map((m) => m.id)).toEqual([message.id]);
		expect((await storage.conversations.get(CONVERSATION))?.lastMessageKind).toBe('audio');
		const file = await openMedia(storage, message.media!);
		expect(file.size).toBe(3000);
		expect(await listPendingUploads(storage)).toEqual([message.id]);
	});

	it('sobe, manda a mensagem de verdade e tira o balão provisório, mantendo o arquivo', async () => {
		const { storage, blossoms, sent, deps } = await setup();
		const message = await start(storage);
		expect(await tryPendingUpload(storage, message.id, deps())).toEqual({ state: 'enviado' });
		expect(sent).toHaveLength(1);
		expect(sent[0].urls).toHaveLength(2);
		expect(sent[0].duration).toBe(4);
		expect(blossoms.map((b) => b.uploads)).toEqual([1, 1]);
		expect((await storage.messages.listByConversation(CONVERSATION, 10)).map((m) => m.id)).toEqual(['real-1']);
		expect((await storage.media.get(message.media!.ox))?.file).toBeDefined();
		expect(await listPendingUploads(storage)).toEqual([]);
	});

	it('com os servidores fora do ar, continua pendente e marca a próxima tentativa', async () => {
		const { storage, blossoms, sent, deps } = await setup();
		blossoms.forEach((b) => (b.rejectUploads = true));
		const message = await start(storage, 1_000_000);
		const result = await tryPendingUpload(storage, message.id, deps({ now: () => 1_000_000, random: () => 1 }));
		expect(result).toEqual({ state: 'depois', at: 1_002_000 });
		expect(sent).toHaveLength(0);
		const kept = await storage.messages.get(message.id);
		expect(kept?.upload).toMatchObject({ attempts: 1, nextAttemptAt: 1_002_000 });
		expect(kept?.upload?.failed).toBeUndefined();

		// o servidor volta: a próxima tentativa funciona, sem mensagem repetida
		blossoms.forEach((b) => (b.rejectUploads = false));
		expect(await tryPendingUpload(storage, message.id, deps())).toEqual({ state: 'enviado' });
		expect(sent).toHaveLength(1);
	});

	it('depois de alguns minutos desiste, avisa no balão e permite tentar de novo', async () => {
		const { storage, blossoms, sent, deps } = await setup();
		blossoms.forEach((b) => (b.rejectUploads = true));
		const message = await start(storage, 1_000_000);
		let now = 1_000_000;
		let result;
		for (let i = 0; i < 100; i++) {
			now += 60_000;
			result = await tryPendingUpload(storage, message.id, deps({ now: () => now, random: () => 1 }));
			if (result.state === 'desistiu') break;
		}
		expect(result).toEqual({ state: 'desistiu' });
		expect(now - 1_000_000).toBeLessThanOrEqual(UPLOAD_GIVE_UP_MS + 60_000);
		expect((await storage.messages.get(message.id))?.upload?.failed).toBe(true);
		expect(await listPendingUploads(storage)).toEqual([]);
		// desistiu: não tenta mais sozinho
		expect(await tryPendingUpload(storage, message.id, deps())).toEqual({ state: 'cancelado' });

		blossoms.forEach((b) => (b.rejectUploads = false));
		expect(await retryPendingUpload(storage, message.id, now)).toBe(true);
		expect(await listPendingUploads(storage)).toEqual([message.id]);
		expect(await tryPendingUpload(storage, message.id, deps())).toEqual({ state: 'enviado' });
		expect(sent).toHaveLength(1);
	});

	it('se a mensagem falha depois do upload, a nova tentativa reaproveita o arquivo já enviado', async () => {
		const { storage, blossoms, sent, deps } = await setup();
		const message = await start(storage);
		const result = await tryPendingUpload(storage, message.id, deps({ now: () => 1_000_000, send: async () => Promise.reject(new Error('Sem conexão com a rede')) }));
		expect(result.state).toBe('depois');
		expect(await tryPendingUpload(storage, message.id, deps())).toEqual({ state: 'enviado' });
		expect(blossoms.map((b) => b.uploads)).toEqual([1, 1]);
		expect(sent).toHaveLength(1);
	});

	it('apagar o balão que não saiu tira a mensagem, o arquivo e o envio da lista', async () => {
		const { storage } = await setup();
		const message = await start(storage);
		await discardPendingUpload(storage, message.id);
		expect(await storage.messages.get(message.id)).toBeUndefined();
		expect(await storage.media.get(message.media!.ox)).toBeUndefined();
		expect(await listPendingUploads(storage)).toEqual([]);
	});
});
