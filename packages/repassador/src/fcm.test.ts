import { afterEach, describe, expect, it } from 'vitest';
import { forgetAccessToken, parseServiceAccount } from './fcm.ts';
import { FCM_BODY_MAX_BYTES, handle, type Env } from './repassador.ts';

const APP = 'https://localhost';
const TOKEN = `dGVzdGU:APA91b${'x'.repeat(140)}`;

function b64u(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Uma conta de serviço como a do console do Firebase, com uma chave RSA nova; `verify` confere o JWT. */
async function serviceAccount() {
	const pair = await crypto.subtle.generateKey(
		{ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
		true,
		['sign', 'verify'],
	);
	const der = new Uint8Array((await crypto.subtle.exportKey('pkcs8', pair.privateKey)) as ArrayBuffer);
	const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...der)).replace(/(.{64})/g, '$1\n')}\n-----END PRIVATE KEY-----\n`;
	const json = JSON.stringify({ type: 'service_account', project_id: 'lerolero-teste', client_email: 'repassador@lerolero-teste.iam.gserviceaccount.com', private_key: pem });
	const verify = async (jwt: string) => {
		const [h, c, s] = jwt.split('.');
		const sig = Uint8Array.from(atob(s!.replace(/-/g, '+').replace(/_/g, '/')), (x) => x.charCodeAt(0));
		return crypto.subtle.verify('RSASSA-PKCS1-v1_5', pair.publicKey, sig, new TextEncoder().encode(`${h}.${c}`));
	};
	return { json, verify };
}

/** O Google falso: o token de acesso e a API do FCM. */
function google(fcmStatus = 200, fcmText = '{"name":"projects/lerolero-teste/messages/1"}') {
	const calls: { url: string; init: RequestInit }[] = [];
	const fetchFn = (async (url: string, init: RequestInit) => {
		calls.push({ url, init });
		if (url === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'ya29.acesso', expires_in: 3599, token_type: 'Bearer' });
		return new Response(fcmText, { status: fcmStatus });
	}) as typeof fetch;
	return { calls, fetchFn };
}

function env(conta?: string): Env {
	return { ORIGENS: `https://capaca.github.io,${APP}`, LIMITE: { limit: async () => ({ success: true }) }, ...(conta ? { FCM_CONTA: conta } : {}) };
}

function post(data: unknown): Request {
	return new Request('https://repassador.example/', { method: 'POST', headers: { Origin: APP, 'CF-Connecting-IP': '1.2.3.4' }, body: JSON.stringify(data) });
}

const valid = { fcm: TOKEN, ttl: 86400, body: b64u(new Uint8Array([9, 8, 7])) };

afterEach(() => forgetAccessToken());

describe('aviso ao app nativo pelo FCM (ADR-0011)', () => {
	it('troca o JWT da conta de serviço por um token e manda mensagem de dados com prioridade alta', async () => {
		const account = await serviceAccount();
		const { calls, fetchFn } = google();
		const res = await handle(post(valid), env(account.json), fetchFn);
		expect(res.status).toBe(200);
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe(APP);
		expect(await res.json()).toMatchObject({ status: 200 });
		expect(calls.map((c) => c.url)).toEqual(['https://oauth2.googleapis.com/token', 'https://fcm.googleapis.com/v1/projects/lerolero-teste/messages:send']);

		const form = new URLSearchParams(String(calls[0]!.init.body));
		expect(form.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
		const jwt = form.get('assertion')!;
		expect(await account.verify(jwt)).toBe(true);
		const claims = JSON.parse(atob(jwt.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')));
		expect(claims).toMatchObject({ iss: 'repassador@lerolero-teste.iam.gserviceaccount.com', scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token' });
		expect(claims.exp - claims.iat).toBe(3600);

		expect((calls[1]!.init.headers as Record<string, string>).Authorization).toBe('Bearer ya29.acesso');
		expect(JSON.parse(String(calls[1]!.init.body))).toEqual({
			message: { token: TOKEN, data: { c: valid.body }, android: { priority: 'HIGH', ttl: '86400s' } },
		});
	});

	it('reaproveita o token de acesso nos avisos seguintes', async () => {
		const account = await serviceAccount();
		const { calls, fetchFn } = google();
		await handle(post(valid), env(account.json), fetchFn);
		await handle(post(valid), env(account.json), fetchFn);
		expect(calls.filter((c) => c.url.includes('oauth2'))).toHaveLength(1);
		expect(calls).toHaveLength(3);
	});

	it('repassa o 404 do token que o FCM não conhece mais, para o remetente parar de avisar', async () => {
		const account = await serviceAccount();
		const { fetchFn } = google(404, '{"error":{"status":"NOT_FOUND","details":[{"errorCode":"UNREGISTERED"}]}}');
		const res = await handle(post(valid), env(account.json), fetchFn);
		expect(await res.json()).toMatchObject({ status: 404 });
	});

	it('sem a conta de serviço, 503 sem chamar ninguém', async () => {
		const { calls, fetchFn } = google();
		expect((await handle(post(valid), env(), fetchFn)).status).toBe(503);
		expect((await handle(post(valid), env('{"project_id":"x"}'), fetchFn)).status).toBe(503);
		expect(calls).toHaveLength(0);
	});

	it('recusa token, ttl ou corpo fora do formato', async () => {
		const account = await serviceAccount();
		const { calls, fetchFn } = google();
		for (const bad of [
			{ ...valid, fcm: 'curto' },
			{ ...valid, fcm: `${TOKEN}/../../outro` },
			{ ...valid, ttl: -1 },
			{ ...valid, body: '' },
			{ ...valid, body: 'não é base64' },
			{ ...valid, body: b64u(new Uint8Array(FCM_BODY_MAX_BYTES + 1)) },
		])
			expect((await handle(post(bad), env(account.json), fetchFn)).status, JSON.stringify(bad).slice(0, 60)).toBe(400);
		expect(calls).toHaveLength(0);
	});

	it('Google fora do ar vira 502', async () => {
		const account = await serviceAccount();
		const res = await handle(post(valid), env(account.json), (() => Promise.reject(new TypeError('rede'))) as typeof fetch);
		expect(res.status).toBe(502);
	});

	it('lê a conta de serviço do console', async () => {
		const { json } = await serviceAccount();
		expect(parseServiceAccount(json)).toMatchObject({ projectId: 'lerolero-teste' });
		expect(parseServiceAccount(undefined)).toBeUndefined();
		expect(parseServiceAccount('não é json')).toBeUndefined();
	});
});
