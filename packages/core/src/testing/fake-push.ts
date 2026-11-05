// Um aparelho que recebe Web Push, para os testes: gera a inscrição como o navegador e decifra o aviso como o
// serviço de push entrega ao service worker (RFC 8291 e RFC 8188, o caminho de volta de push/webpush.ts).

import { fromBase64Url, generateVapid, toBase64Url, type PushTarget } from '../push/webpush.ts';

const enc = new TextEncoder();

async function hkdf(salt: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, bits: number) {
	const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
	return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bits));
}

/** Decifra um corpo aes128gcm de um registro só com a chave privada do aparelho. */
export async function decryptPush(body: Uint8Array<ArrayBuffer>, uaPrivate: CryptoKey, uaPublic: Uint8Array<ArrayBuffer>, auth: Uint8Array<ArrayBuffer>) {
	const salt = body.slice(0, 16);
	const idLength = body[20];
	const asPublic = body.slice(21, 21 + idLength);
	const cipher = body.slice(21 + idLength);
	const as = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
	const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: as }, uaPrivate, 256));
	const info = new Uint8Array([...enc.encode('WebPush: info\0'), ...uaPublic, ...asPublic]);
	const ikm = await hkdf(auth, ecdh, info, 256);
	const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 128);
	const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 96);
	const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
	const padded = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aes, cipher));
	if (padded[padded.length - 1] !== 2) throw new Error('falta a marca de último registro');
	return padded.slice(0, -1);
}

let n = 0;

/** Inscrição nova num serviço conhecido, com o par VAPID; `open` decifra o que chegou para ela. */
export async function fakePushDevice(host = 'fcm.googleapis.com') {
	const ua = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
	const uaPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey));
	const auth = crypto.getRandomValues(new Uint8Array(16));
	const target: PushTarget = {
		endpoint: `https://${host}/fcm/send/aparelho-${n++}`,
		p256dh: toBase64Url(uaPublic),
		auth: toBase64Url(auth),
		vapid: await generateVapid()
	};
	const open = async (body: string) => JSON.parse(new TextDecoder().decode(await decryptPush(fromBase64Url(body), ua.privateKey, uaPublic, auth)));
	return { target, open };
}
