import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openStorage } from '../storage/repositories.ts';
import { fakeNativeDevice, fakePushDevice } from '../testing/fake-push.ts';
import { PUSH_BURST_MS, PushNotifier } from './notifier.ts';
import type { PushRelayRequest, PushTarget } from './webpush.ts';

const ME = 'a'.repeat(64);
const BIA = 'b'.repeat(64);
const RELAY = 'https://repassador.exemplo';

const closers: Array<() => void> = [];
afterEach(() => {
	closers.splice(0).forEach((c) => c());
	vi.useRealTimers();
});

let n = 0;
async function setup(push?: PushTarget[], status = 201) {
	const storage = openStorage(`avisos-${n++}`);
	closers.push(() => storage.close());
	await storage.contacts.put({ publicKey: BIA, state: 'aceito', dmRelays: [], addedAt: 1 });
	await storage.profiles.put({ publicKey: BIA, name: 'Bia', relays: [], features: [], ...(push ? { push } : {}), updatedAt: 1 });
	const sent: Array<{ url: string; request: PushRelayRequest }> = [];
	const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
		sent.push({ url: String(url), request: JSON.parse(String(init?.body)) });
		return new Response(JSON.stringify({ status, resposta: '' }), { status: 200 });
	}) as unknown as typeof globalThis.fetch;
	const notifier = new PushNotifier({ storage, relay: RELAY, me: ME, myName: () => 'Ana  Souza', fetch });
	closers.push(() => notifier.stop());
	return { storage, sent, notifier };
}

/** Dá tempo ao envio, que cifra e lê o banco de forma assíncrona, para conferir que nada saiu. */
const settle = () => new Promise((r) => setTimeout(r, 100));

describe('aviso de mensagem nova', () => {
	it('vai a cada aparelho da pessoa, pelo repassador, só com o nome de quem mandou', async () => {
		const [phone, laptop] = [await fakePushDevice(), await fakePushDevice('web.push.apple.com')];
		const { sent, notifier } = await setup([phone.target, laptop.target]);
		notifier.notify(BIA, 'grupo1');
		await vi.waitFor(() => expect(sent).toHaveLength(2));
		expect(sent.map((s) => s.url)).toEqual([RELAY, RELAY]);
		expect(sent.map((s) => 'endpoint' in s.request && s.request.endpoint).sort()).toEqual([phone.target.endpoint, laptop.target.endpoint].sort());
		const forPhone = sent.find((s) => 'endpoint' in s.request && s.request.endpoint === phone.target.endpoint)!;
		expect(await phone.open(forPhone.request.body)).toEqual({ v: 1, de: ME, nome: 'Ana Souza', grupo: 'grupo1' });
	});

	it('ao app nativo, pelo token do FCM, cifrado para a chave do app (ADR-0011)', async () => {
		const app = await fakeNativeDevice();
		const { sent, notifier } = await setup([app.target]);
		notifier.notify(BIA);
		await vi.waitFor(() => expect(sent).toHaveLength(1));
		const { request } = sent[0];
		expect(request).toEqual({ fcm: app.target.fcm, ttl: 86400, body: request.body });
		expect(await app.open(request.body)).toEqual({ v: 1, de: ME, nome: 'Ana Souza' });
	});

	it('token do app que o FCM não conhece mais (404) sai do cartão guardado', async () => {
		const [web, app] = [await fakePushDevice(), await fakeNativeDevice()];
		const { storage, notifier } = await setup([web.target, app.target], 404);
		notifier.notify(BIA);
		await vi.waitFor(async () => expect((await storage.profiles.get(BIA))?.push).toBeUndefined());
	});

	it('uma rajada vira dois avisos: o primeiro na hora e um no fim da janela', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
		const device = await fakePushDevice();
		const { sent, notifier } = await setup([device.target]);
		notifier.notify(BIA);
		await vi.waitFor(() => expect(sent).toHaveLength(1));
		for (let i = 0; i < 5; i++) {
			await vi.advanceTimersByTimeAsync(1000);
			notifier.notify(BIA, 'grupo2');
		}
		await vi.advanceTimersByTimeAsync(PUSH_BURST_MS - 5001);
		expect(sent).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(2);
		await vi.waitFor(() => expect(sent).toHaveLength(2));
		expect((await device.open(sent[1].request.body)).grupo).toBe('grupo2');
		// passada a janela, o próximo sai na hora
		await vi.advanceTimersByTimeAsync(PUSH_BURST_MS);
		notifier.notify(BIA);
		await vi.waitFor(() => expect(sent).toHaveLength(3));
	});

	it('inscrição que acabou (410) sai do cartão guardado', async () => {
		const device = await fakePushDevice();
		const { storage, sent, notifier } = await setup([device.target], 410);
		notifier.notify(BIA);
		await vi.waitFor(async () => expect((await storage.profiles.get(BIA))?.push).toBeUndefined());
		expect(sent).toHaveLength(1);
	});

	it('não vai a quem não ativou, a bloqueado nem a mim mesmo', async () => {
		const { sent, notifier } = await setup();
		notifier.notify(BIA);
		const device = await fakePushDevice();
		const blocked = await setup([device.target]);
		await blocked.storage.contacts.put({ publicKey: BIA, state: 'bloqueado', dmRelays: [], addedAt: 1 });
		blocked.notifier.notify(BIA);
		blocked.notifier.notify(ME);
		await settle();
		expect(sent).toHaveLength(0);
		expect(blocked.sent).toHaveLength(0);
	});

	it('repassador fora do ar não quebra nada', async () => {
		const device = await fakePushDevice();
		const { storage } = await setup([device.target]);
		const notifier = new PushNotifier({ storage, relay: RELAY, me: ME, myName: () => 'Ana', fetch: () => Promise.reject(new TypeError('rede')) });
		notifier.notify(BIA);
		await settle();
		expect((await storage.profiles.get(BIA))?.push).toEqual([device.target]);
	});
});
