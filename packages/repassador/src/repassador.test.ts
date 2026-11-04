import { describe, expect, it } from 'vitest';
import { allowedEndpoint, allowedOrigin, BODY_MAX_BYTES, handle, type Env } from './repassador.ts';

const APP = 'https://capaca.github.io';
const FCM = 'https://fcm.googleapis.com/fcm/send/abc:123';

function env(over: Partial<Env> = {}, permitir = () => true): Env {
	return { ORIGENS: `${APP},https://outra.example`, LIMITE: { limit: async () => ({ success: permitir() }) }, ...over };
}

function b64u(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const valid = {
	endpoint: FCM,
	ttl: 86400,
	urgency: 'high',
	authorization: 'vapid t=eyJ0.eyJh.c2ln, k=BPub_key-1',
	body: b64u(new Uint8Array([1, 2, 3, 250])),
};

function post(data: unknown, { origin = APP, ip = '1.2.3.4' }: { origin?: string | null; ip?: string } = {}): Request {
	const headers: Record<string, string> = { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip };
	if (origin) headers.Origin = origin;
	return new Request('https://repassador.example/', { method: 'POST', headers, body: typeof data === 'string' ? data : JSON.stringify(data) });
}

// Serviço de push falso: guarda o que recebeu e responde como o FCM
function pushService(status = 201, text = '') {
	const calls: { url: string; init: RequestInit }[] = [];
	const fetchFn = (async (url: string, init: RequestInit) => {
		calls.push({ url, init });
		return new Response(text, { status });
	}) as typeof fetch;
	return { calls, fetchFn };
}

describe('repassador de push', () => {
	it('encaminha o aviso ao serviço de push com os cabeçalhos do RFC 8030 e devolve a resposta dele', async () => {
		const { calls, fetchFn } = pushService(201);
		const res = await handle(post(valid), env(), fetchFn);
		expect(res.status).toBe(200);
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe(APP);
		expect(await res.json()).toEqual({ status: 201, resposta: '' });
		expect(calls).toHaveLength(1);
		expect(calls[0]!.url).toBe(FCM);
		expect(calls[0]!.init.headers).toEqual({
			TTL: '86400',
			Urgency: 'high',
			Authorization: valid.authorization,
			'Content-Encoding': 'aes128gcm',
			'Content-Type': 'application/octet-stream',
		});
		expect([...(calls[0]!.init.body as Uint8Array)]).toEqual([1, 2, 3, 250]);
		expect(calls[0]!.init.redirect).toBe('manual');
	});

	it('repassa a recusa do serviço (410 = inscrição cancelada), para o remetente parar de avisar', async () => {
		const { fetchFn } = pushService(410, 'push subscription has unsubscribed or expired.\n');
		const res = await handle(post(valid), env(), fetchFn);
		expect(await res.json()).toEqual({ status: 410, resposta: 'push subscription has unsubscribed or expired.\n' });
	});

	it('responde 502 quando o serviço de push não responde', async () => {
		const fetchFn = (async () => {
			throw new TypeError('fetch failed');
		}) as typeof fetch;
		const res = await handle(post(valid), env(), fetchFn);
		expect(res.status).toBe(502);
	});

	it('recusa origens que não são do app, sem encaminhar nada', async () => {
		const { calls, fetchFn } = pushService();
		for (const origin of ['https://malicioso.example', null, 'http://localhost:5180']) {
			const res = await handle(post(valid, { origin }), env(), fetchFn);
			expect(res.status).toBe(403);
			expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
		}
		expect(calls).toHaveLength(0);
	});

	it('responde ao preflight do CORS só para as origens do app', async () => {
		const preflight = (origin: string) =>
			handle(new Request('https://repassador.example/', { method: 'OPTIONS', headers: { Origin: origin } }), env(), pushService().fetchFn);
		const ok = await preflight(APP);
		expect(ok.status).toBe(204);
		expect(ok.headers.get('Access-Control-Allow-Methods')).toBe('POST');
		expect(ok.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
		expect((await preflight('https://malicioso.example')).status).toBe(403);
	});

	it('limita os pedidos por IP e responde 429 sem encaminhar', async () => {
		const keys: string[] = [];
		const e = env({ LIMITE: { limit: async ({ key }) => (keys.push(key), { success: false }) } });
		const { calls, fetchFn } = pushService();
		const res = await handle(post(valid, { ip: '9.8.7.6' }), e, fetchFn);
		expect(res.status).toBe(429);
		expect(res.headers.get('Retry-After')).toBe('60');
		expect(keys).toEqual(['9.8.7.6']);
		expect(calls).toHaveLength(0);
	});

	it('recusa destinos que não são serviços de push, para não virar proxy aberto', async () => {
		const { calls, fetchFn } = pushService();
		for (const endpoint of [
			'https://exemplo.com/fcm/send/x',
			'http://fcm.googleapis.com/fcm/send/x',
			'https://fcm.googleapis.com:8443/fcm/send/x',
			'https://usuario@fcm.googleapis.com/fcm/send/x',
			'https://fcm.googleapis.com.exemplo.com/x',
			'https://169.254.169.254/latest',
			'não é url',
		]) {
			const res = await handle(post({ ...valid, endpoint }), env(), fetchFn);
			expect(res.status, endpoint).toBe(400);
		}
		expect(calls).toHaveLength(0);
	});

	it('recusa campos inválidos', async () => {
		const { calls, fetchFn } = pushService();
		const bad = [
			{ ...valid, ttl: -1 },
			{ ...valid, ttl: 1.5 },
			{ ...valid, ttl: 29 * 24 * 3600 },
			{ ...valid, urgency: 'urgente' },
			{ ...valid, authorization: 'Bearer x' },
			{ ...valid, authorization: 'vapid t=a, k=b\r\nX-Injetado: 1' },
			{ ...valid, body: '' },
			{ ...valid, body: 'não+é/base64url' },
			{ ...valid, body: b64u(new Uint8Array(BODY_MAX_BYTES + 1)) },
			null,
			[],
		];
		for (const data of bad) {
			const res = await handle(post(data), env(), fetchFn);
			expect(res.status, JSON.stringify(data)).toBe(400);
		}
		expect((await handle(post('{ não é json'), env(), fetchFn)).status).toBe(400);
		expect((await handle(post({ ...valid, body: 'A'.repeat(20_000) }), env(), fetchFn)).status).toBe(413);
		expect(calls).toHaveLength(0);
	});

	it('aceita o aviso de 4096 bytes, o máximo garantido pelos serviços', async () => {
		const { calls, fetchFn } = pushService();
		const res = await handle(post({ ...valid, body: b64u(new Uint8Array(BODY_MAX_BYTES)) }), env(), fetchFn);
		expect(res.status).toBe(200);
		expect(calls).toHaveLength(1);
	});

	it('só aceita POST na raiz', async () => {
		const { fetchFn } = pushService();
		const get = new Request('https://repassador.example/', { headers: { Origin: APP } });
		expect((await handle(get, env(), fetchFn)).status).toBe(405);
		const outro = new Request('https://repassador.example/outro', { method: 'POST', headers: { Origin: APP }, body: JSON.stringify(valid) });
		expect((await handle(outro, env(), fetchFn)).status).toBe(405);
	});
});

describe('serviços de push conhecidos', () => {
	it('aceita os do Chrome, Firefox, Safari e Edge', () => {
		expect(allowedEndpoint('https://fcm.googleapis.com/fcm/send/x')).toBe(true);
		expect(allowedEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true);
		expect(allowedEndpoint('https://web.push.apple.com/QGx')).toBe(true);
		expect(allowedEndpoint('https://wns2-par02p.notify.windows.com/w/?token=x')).toBe(true);
	});
});

describe('origens locais', () => {
	it('só com ORIGENS_LOCAIS (homologação): localhost e a rede local em http', () => {
		const homolog = env({ ORIGENS: 'https://lerolero-app.github.io', ORIGENS_LOCAIS: 'sim' });
		for (const o of ['http://localhost:5180', 'http://127.0.0.1:4190', 'http://192.168.0.12:5180', 'http://10.0.0.5:5180', 'http://172.20.1.1:5180'])
			expect(allowedOrigin(o, homolog), o).toBe(true);
		for (const o of ['https://capaca.github.io', 'http://8.8.8.8:5180', 'http://172.32.0.1', 'http://localhost.exemplo.com'])
			expect(allowedOrigin(o, homolog), o).toBe(false);
		expect(allowedOrigin('http://localhost:5180', env())).toBe(false);
	});
});
