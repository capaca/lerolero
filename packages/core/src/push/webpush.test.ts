import { describe, expect, it } from 'vitest';
import { decryptPush, fakePushDevice } from '../testing/fake-push.ts';
import { encryptPayload, fromBase64Url, generateVapid, pushRequest, toBase64Url, validEndpoint, validTarget, vapidAuthorization } from './webpush.ts';

const enc = new TextEncoder();

/** Chave P-256 a partir do ponto público e do escalar em base64url, como no apêndice A do RFC 8291. */
function ecdhKey(publicKey: string, privateKey: string) {
	const raw = fromBase64Url(publicKey);
	const jwk = { kty: 'EC', crv: 'P-256', x: toBase64Url(raw.slice(1, 33)), y: toBase64Url(raw.slice(33, 65)), d: privateKey };
	return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
}

describe('cifra do aviso (RFC 8291)', () => {
	it('dá o mesmo resultado do exemplo do RFC 8291', async () => {
		const asPublic = 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8';
		const asKeys = {
			publicKey: await crypto.subtle.importKey('raw', fromBase64Url(asPublic), { name: 'ECDH', namedCurve: 'P-256' }, true, []),
			privateKey: await ecdhKey(asPublic, 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw')
		};
		const body = await encryptPayload(
			enc.encode('When I grow up, I want to be a watermelon'),
			{ p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', auth: 'BTBZMqHH6r4Tts7J_aSIgg' },
			{ senderKeys: asKeys, salt: fromBase64Url('DGv6ra1nlYgDCS1FRnbzlw') }
		);
		expect(toBase64Url(body)).toBe(
			'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN'
		);
	});

	it('só o aparelho abre, e cada aviso sai diferente', async () => {
		const device = await fakePushDevice();
		const a = await pushRequest(device.target, { nome: 'Ana' });
		const b = await pushRequest(device.target, { nome: 'Ana' });
		expect(a.body).not.toBe(b.body);
		expect(await device.open(a.body)).toEqual({ nome: 'Ana' });
		const other = await fakePushDevice();
		await expect(other.open(a.body)).rejects.toThrow();
	});

	it('pede o que o repassador aceita', async () => {
		const device = await fakePushDevice();
		const request = await pushRequest(device.target, { nome: 'Ana' });
		expect(request).toMatchObject({ endpoint: device.target.endpoint, ttl: 86400, urgency: 'high' });
		expect('authorization' in request && request.authorization).toMatch(/^vapid t=[\w.-]+, k=[\w-]+$/);
		expect(fromBase64Url(request.body).length).toBeLessThan(4096);
	});
});

describe('VAPID (RFC 8292)', () => {
	it('assina para o serviço de push com a chave do destinatário', async () => {
		const vapid = await generateVapid();
		const now = Date.UTC(2026, 10, 4);
		const header = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', vapid, now);
		const [, jwt, k] = header.match(/^vapid t=(.+), k=(.+)$/)!;
		expect(k).toBe(vapid.publicKey);
		const [h, c, s] = jwt.split('.');
		expect(JSON.parse(new TextDecoder().decode(fromBase64Url(c)))).toEqual({
			aud: 'https://fcm.googleapis.com',
			exp: now / 1000 + 12 * 3600,
			sub: 'https://capaca.github.io/lerolero/'
		});
		const key = await crypto.subtle.importKey('raw', fromBase64Url(vapid.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
		const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, fromBase64Url(s), enc.encode(`${h}.${c}`));
		expect(ok).toBe(true);
	});
});

describe('aparelho vindo de fora', () => {
	it('só aceita serviço de push conhecido', () => {
		expect(validEndpoint('https://fcm.googleapis.com/fcm/send/x')).toBe(true);
		expect(validEndpoint('https://web.push.apple.com/abc')).toBe(true);
		expect(validEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true);
		expect(validEndpoint('http://fcm.googleapis.com/x')).toBe(false);
		expect(validEndpoint('https://fcm.googleapis.com:8443/x')).toBe(false);
		expect(validEndpoint('https://exemplo.com/x')).toBe(false);
		expect(validEndpoint('https://fcm.googleapis.com.exemplo.com/x')).toBe(false);
	});

	it('confere o tamanho de cada chave', async () => {
		const { target } = await fakePushDevice();
		expect(validTarget(target)).toBe(true);
		expect(validTarget({ ...target, auth: 'curto' })).toBe(false);
		expect(validTarget({ ...target, p256dh: target.vapid.privateKey })).toBe(false);
		expect(validTarget({ ...target, vapid: { ...target.vapid, privateKey: 'não é base64' } })).toBe(false);
	});

	it('decifra com a chave certa (o aparelho falso dos testes)', async () => {
		const ua = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
		const uaPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey));
		const auth = crypto.getRandomValues(new Uint8Array(16));
		const body = await encryptPayload(enc.encode('oi'), { p256dh: toBase64Url(uaPublic), auth: toBase64Url(auth) });
		expect(new TextDecoder().decode(await decryptPush(body, ua.privateKey, uaPublic, auth))).toBe('oi');
	});
});
