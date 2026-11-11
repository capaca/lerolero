// Web Push sem servidor do projeto (ADR-0010): o app de quem manda cifra o aviso para o aparelho de quem recebe
// (RFC 8291, aes128gcm) e assina o JWT VAPID (RFC 8292) com a chave que o destinatário pôs no cartão de perfil. O
// repassador (packages/repassador) só encaminha o pedido ao serviço de push, que o Chrome não deixa chamar direto
// (CORS). Tudo com o WebCrypto, que existe no navegador, no worker e no Node. Porte de prototipos/push/comum.js,
// medido no Motorola em 2026-11-02.

/** Um navegador que recebe avisos: a inscrição dele (PushSubscription) e o par VAPID dela. */
export type WebPushTarget = {
	endpoint: string;
	/** chave pública ECDH P-256 do navegador (65 bytes), em base64url */
	p256dh: string;
	/** segredo de 16 bytes do navegador, em base64url */
	auth: string;
	/** par VAPID do aparelho: a privada vai no cartão, para os contatos assinarem sem servidor (ADR-0010) */
	vapid: VapidKeys;
};

/**
 * O app nativo (ADR-0011): o token do FCM e o par de cifra que o próprio app gerou (a privada fica no aparelho). O
 * aviso vai cifrado do mesmo jeito (RFC 8291), e o repassador manda pela API do FCM com a credencial do projeto.
 */
export type NativePushTarget = {
	fcm: string;
	/** chave pública ECDH P-256 do app (65 bytes), em base64url */
	p256dh: string;
	/** segredo de 16 bytes do app, em base64url */
	auth: string;
};

/** Um aparelho que recebe avisos: um navegador ou o app nativo. */
export type PushTarget = WebPushTarget | NativePushTarget;

export function isNativeTarget(target: PushTarget): target is NativePushTarget {
	return 'fcm' in target;
}

/** O que identifica o aparelho no serviço de push: o endereço do navegador ou o token do FCM. */
export function targetKey(target: PushTarget): string {
	return isNativeTarget(target) ? `fcm:${target.fcm}` : target.endpoint;
}

export type VapidKeys = {
	/** ponto P-256 sem compressão (65 bytes), em base64url: o `applicationServerKey` da inscrição */
	publicKey: string;
	/** escalar de 32 bytes, em base64url */
	privateKey: string;
};

/** O que o repassador recebe (PushRelayRequest em packages/repassador): Web Push ou FCM. */
export type PushRelayRequest =
	| { endpoint: string; ttl: number; urgency: string; authorization: string; body: string }
	| { fcm: string; ttl: number; body: string };

/** Um dia: depois disso o aviso perde o sentido (a mensagem continua nos relays por 7 dias). */
export const PUSH_TTL_S = 24 * 60 * 60;
/** Quem o serviço de push contata se houver abuso (RFC 8292); a Apple recusa sem `sub`. */
const VAPID_SUBJECT = 'https://capaca.github.io/lerolero/';
/** O JWT pode valer até 24 h; 12 h dá folga para relógio adiantado. */
const VAPID_VALIDITY_S = 12 * 60 * 60;
/** Tamanho de registro do aes128gcm: um registro só, o aviso cabe nele. */
const RECORD_SIZE = 4096;

/**
 * Serviços de push dos navegadores (a mesma lista do repassador): endereço de outro lugar, num cartão, é descartado
 * em vez de virar pedido recusado.
 */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^[a-z0-9-]+\.push\.apple\.com$/, /^[a-z0-9-]+\.notify\.windows\.com$/];

const enc = new TextEncoder();

export function toBase64Url(bytes: Uint8Array): string {
	let s = '';
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
	if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error('base64url inválido');
	const s = atob(text.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (text.length % 4)) % 4));
	return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let i = 0;
	for (const p of parts) {
		out.set(p, i);
		i += p.length;
	}
	return out;
}

function bytesOf(text: string, length: number): boolean {
	if (typeof text !== 'string') return false;
	try {
		return fromBase64Url(text).length === length;
	} catch {
		return false;
	}
}

/** Endereço de push que dá para usar: https, de um serviço conhecido, sem porta nem usuário. */
export function validEndpoint(endpoint: string): boolean {
	let url: URL;
	try {
		url = new URL(endpoint);
	} catch {
		return false;
	}
	return url.protocol === 'https:' && !url.port && !url.username && !url.password && endpoint.length <= 1024 && PUSH_HOSTS.some((h) => h.test(url.hostname));
}

/** Token do FCM: letras, números e `_:-`, com folga no tamanho (o de hoje tem uns 160). */
const FCM_TOKEN = /^[\w:-]{32,512}$/;

/** Confere um aparelho que veio de fora (cartão de um contato ou aviso de outro aparelho meu). */
export function validTarget(target: PushTarget): boolean {
	const point = (text: string) => typeof text === 'string' && bytesOf(text, 65) && fromBase64Url(text)[0] === 4;
	if (isNativeTarget(target)) return typeof target.fcm === 'string' && FCM_TOKEN.test(target.fcm) && point(target.p256dh) && bytesOf(target.auth, 16);
	return (
		validEndpoint(target.endpoint) &&
		point(target.p256dh) &&
		bytesOf(target.auth, 16) &&
		point(target.vapid.publicKey) &&
		bytesOf(target.vapid.privateKey, 32)
	);
}

/** Par VAPID novo, só deste aparelho: ao ativar as notificações e ao bloquear alguém (ADR-0010). */
export async function generateVapid(): Promise<VapidKeys> {
	const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
	const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
	const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
	return { publicKey: toBase64Url(raw), privateKey: jwk.d! };
}

function importVapid({ publicKey, privateKey }: VapidKeys): Promise<CryptoKey> {
	const raw = fromBase64Url(publicKey);
	const jwk = { kty: 'EC', crv: 'P-256', x: toBase64Url(raw.slice(1, 33)), y: toBase64Url(raw.slice(33, 65)), d: privateKey };
	return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

/** Cabeçalho Authorization (RFC 8292): JWT ES256; a assinatura do WebCrypto já vem em r||s, o formato do JWS. */
export async function vapidAuthorization(endpoint: string, vapid: VapidKeys, now = Date.now()): Promise<string> {
	const header = toBase64Url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
	const claims = toBase64Url(
		enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + VAPID_VALIDITY_S, sub: VAPID_SUBJECT }))
	);
	const key = await importVapid(vapid);
	const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`)));
	return `vapid t=${header}.${claims}.${toBase64Url(sig)}, k=${vapid.publicKey}`;
}

async function hkdf(salt: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, bits: number) {
	const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
	return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bits));
}

/** Para o teste com o exemplo do RFC 8291: o par efêmero e o sal fixos. */
export type EncryptFixture = { senderKeys: CryptoKeyPair; salt: Uint8Array<ArrayBuffer> };

/** RFC 8291 com aes128gcm (RFC 8188), um registro só: o serviço de push e o repassador veem só bytes cifrados. */
export async function encryptPayload(
	plaintext: Uint8Array,
	{ p256dh, auth }: Pick<PushTarget, 'p256dh' | 'auth'>,
	fixture?: EncryptFixture
): Promise<Uint8Array<ArrayBuffer>> {
	const uaPublic = fromBase64Url(p256dh);
	const ua = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
	const as = fixture?.senderKeys ?? (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']));
	const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
	const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: ua }, as.privateKey, 256));

	const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic);
	const ikm = await hkdf(fromBase64Url(auth), ecdhSecret, keyInfo, 256);
	const salt = fixture?.salt ?? crypto.getRandomValues(new Uint8Array(16));
	const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 128);
	const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 96);

	// 0x02 marca o último registro
	const padded = concat(plaintext, Uint8Array.of(2));
	const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
	const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, padded));
	const rs = Uint8Array.of(0, 0, RECORD_SIZE >> 8, RECORD_SIZE & 0xff);
	return concat(salt, rs, Uint8Array.of(asPublic.length), asPublic, cipher);
}

/**
 * O pedido ao repassador para um aparelho; `Urgency: high` pede a prioridade que acorda o Android (quando deixa). O
 * app nativo recebe pelo FCM com prioridade alta, que acorda o celular parado (ADR-0011).
 */
export async function pushRequest(target: PushTarget, payload: unknown, now = Date.now()): Promise<PushRelayRequest> {
	const body = await encryptPayload(enc.encode(JSON.stringify(payload)), target);
	if (isNativeTarget(target)) return { fcm: target.fcm, ttl: PUSH_TTL_S, body: toBase64Url(body) };
	return {
		endpoint: target.endpoint,
		ttl: PUSH_TTL_S,
		urgency: 'high',
		authorization: await vapidAuthorization(target.endpoint, target.vapid, now),
		body: toBase64Url(body)
	};
}
