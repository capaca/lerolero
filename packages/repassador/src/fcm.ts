// Envio ao app nativo pela API HTTP v1 do FCM (ADR-0011). Diferente do Web Push, aqui o repassador tem credencial: a
// conta de serviço do projeto do Firebase (secret FCM_CONTA), com a qual troca um JWT por um token de acesso do
// Google. O aviso continua cifrado pelo remetente para a chave do app (RFC 8291): o repassador e o Google só veem
// bytes cifrados e o token de quem recebe.

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
// o token de acesso vale 1 h; renova com 5 min de folga
const TOKEN_MARGIN_S = 300;

export interface ServiceAccount {
	projectId: string;
	clientEmail: string;
	privateKey: string;
}

/** Lê o JSON da conta de serviço que o console do Firebase entrega; undefined se faltar algo. */
export function parseServiceAccount(text: string | undefined): ServiceAccount | undefined {
	if (!text) return undefined;
	try {
		const j = JSON.parse(text) as Record<string, unknown>;
		const { project_id: projectId, client_email: clientEmail, private_key: privateKey } = j;
		if (typeof projectId !== 'string' || !/^[a-z0-9-]{4,40}$/.test(projectId)) return undefined;
		if (typeof clientEmail !== 'string' || typeof privateKey !== 'string' || !privateKey.includes('PRIVATE KEY')) return undefined;
		return { projectId, clientEmail, privateKey };
	} catch {
		return undefined;
	}
}

function base64Url(bytes: Uint8Array | string): string {
	const s = typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes);
	return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function utf8Base64Url(text: string): string {
	return base64Url(new TextEncoder().encode(text));
}

async function importKey(pem: string): Promise<CryptoKey> {
	const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')), (c) => c.charCodeAt(0));
	return crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

/** O JWT da conta de serviço (RS256), trocado no Google por um token de acesso. */
export async function serviceAccountJwt(account: ServiceAccount, nowS: number): Promise<string> {
	const header = utf8Base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
	const claims = utf8Base64Url(JSON.stringify({ iss: account.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: nowS, exp: nowS + 3600 }));
	const key = await importKey(account.privateKey);
	const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`)));
	return `${header}.${claims}.${base64Url(sig)}`;
}

// guardado na memória da instância do Worker, que vive alguns minutos: sem isto, cada aviso faria duas chamadas
let cached: { email: string; token: string; until: number } | undefined;

export function forgetAccessToken() {
	cached = undefined;
}

export async function accessToken(account: ServiceAccount, forward: typeof fetch, nowS = Math.floor(Date.now() / 1000)): Promise<string> {
	if (cached && cached.email === account.clientEmail && cached.until > nowS) return cached.token;
	const assertion = await serviceAccountJwt(account, nowS);
	const res = await forward(TOKEN_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
		redirect: 'manual',
		signal: AbortSignal.timeout(10_000),
	});
	if (!res.ok) throw new Error(`o Google recusou a conta de serviço (${res.status})`);
	const { access_token: token, expires_in: expires } = (await res.json()) as { access_token?: string; expires_in?: number };
	if (typeof token !== 'string') throw new Error('resposta sem token de acesso');
	cached = { email: account.clientEmail, token, until: nowS + (typeof expires === 'number' ? expires : 3600) - TOKEN_MARGIN_S };
	return token;
}

/**
 * O pedido ao FCM: mensagem só de dados (o app decifra e mostra), com prioridade alta, que acorda o celular parado.
 * `body` é o aviso cifrado em base64url, como veio do remetente.
 */
export async function sendFcm(account: ServiceAccount, fcmToken: string, body: string, ttl: number, forward: typeof fetch): Promise<Response> {
	const token = await accessToken(account, forward);
	return forward(`https://fcm.googleapis.com/v1/projects/${account.projectId}/messages:send`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({ message: { token: fcmToken, data: { c: body }, android: { priority: 'HIGH', ttl: `${ttl}s` } } }),
		redirect: 'manual',
		signal: AbortSignal.timeout(10_000),
	});
}
