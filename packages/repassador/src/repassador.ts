// Repassador de Web Push (ADR-0010): o Chrome do remetente não consegue fazer o POST direto no FCM (CORS), então o
// app manda o aviso já cifrado e assinado para cá, e o repassador só o encaminha. Não guarda nada, não registra nada
// e não tem credencial: a cifra (RFC 8291) e o JWT VAPID (RFC 8292) vêm prontos do remetente.

// Serviços de push dos navegadores; qualquer outro destino é recusado, para não virar um proxy aberto
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^[a-z0-9-]+\.push\.apple\.com$/, /^[a-z0-9-]+\.notify\.windows\.com$/];

// 4096 bytes é o que todo serviço de push garante aceitar (RFC 8030)
export const BODY_MAX_BYTES = 4096;
const REQUEST_MAX_BYTES = 16 * 1024;
// 28 dias, o máximo do FCM
const TTL_MAX = 28 * 24 * 60 * 60;
const URGENCIES = ['very-low', 'low', 'normal', 'high'];
const FORWARD_TIMEOUT_MS = 10_000;
const ANSWER_MAX_CHARS = 500;

export interface RateLimit {
	limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
	// Origens do app separadas por vírgula (produção ou homologação)
	ORIGENS: string;
	// "sim" aceita também localhost e a rede local (dev e celular.sh), só na homologação
	ORIGENS_LOCAIS?: string;
	// 120 pedidos por minuto por IP (decidido em 2026-11-04): cabe a rajada de um grupo grande
	LIMITE: RateLimit;
}

// O que o app manda: o pedido ao serviço de push, desmontado em campos para o repassador conferir cada um
export interface PushRelayRequest {
	endpoint: string;
	ttl: number;
	urgency: string;
	authorization: string;
	// o aviso cifrado (aes128gcm), em base64url
	body: string;
}

// O que o app recebe quando o pedido foi encaminhado: a resposta do serviço de push (404 ou 410 = inscrição
// cancelada, a pessoa trocou as chaves ou desativou)
export interface PushRelayResult {
	status: number;
	resposta: string;
}

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

export function allowedOrigin(origin: string | null, env: Env): boolean {
	if (!origin) return false;
	if (env.ORIGENS.split(',').some((o) => o.trim() === origin)) return true;
	if (env.ORIGENS_LOCAIS !== 'sim') return false;
	try {
		const url = new URL(origin);
		return url.protocol === 'http:' && LOCAL_HOST.test(url.hostname);
	} catch {
		return false;
	}
}

export function allowedEndpoint(endpoint: string): boolean {
	let url: URL;
	try {
		url = new URL(endpoint);
	} catch {
		return false;
	}
	return url.protocol === 'https:' && !url.port && !url.username && !url.password && PUSH_HOSTS.some((h) => h.test(url.hostname));
}

function decodeBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
	if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
	const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4));
	return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

type Parsed = { ok: true; request: PushRelayRequest; body: Uint8Array<ArrayBuffer> } | { ok: false; erro: string };

export function parseRequest(value: unknown): Parsed {
	if (!value || typeof value !== 'object') return { ok: false, erro: 'pedido inválido' };
	const r = value as Record<string, unknown>;
	if (typeof r.endpoint !== 'string' || !allowedEndpoint(r.endpoint)) return { ok: false, erro: 'destino não é um serviço de push conhecido' };
	if (typeof r.ttl !== 'number' || !Number.isInteger(r.ttl) || r.ttl < 0 || r.ttl > TTL_MAX) return { ok: false, erro: 'ttl inválido' };
	if (typeof r.urgency !== 'string' || !URGENCIES.includes(r.urgency)) return { ok: false, erro: 'urgency inválida' };
	// só o formato do RFC 8292; a assinatura quem confere é o serviço de push
	if (typeof r.authorization !== 'string' || !/^vapid t=[\w.-]+, k=[\w-]+$/.test(r.authorization) || r.authorization.length > 1024)
		return { ok: false, erro: 'authorization inválida' };
	const body = typeof r.body === 'string' ? decodeBase64Url(r.body) : null;
	if (!body || body.length === 0) return { ok: false, erro: 'body inválido' };
	if (body.length > BODY_MAX_BYTES) return { ok: false, erro: 'body grande demais' };
	return { ok: true, request: r as unknown as PushRelayRequest, body };
}

function corsHeaders(origin: string): Record<string, string> {
	return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
}

function json(status: number, data: unknown, headers: Record<string, string> = {}): Response {
	return new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

export async function handle(request: Request, env: Env, forward: typeof fetch): Promise<Response> {
	const origin = request.headers.get('Origin');
	if (!allowedOrigin(origin, env)) return json(403, { erro: 'origem não permitida' });
	const cors = corsHeaders(origin!);

	if (request.method === 'OPTIONS') {
		return new Response(null, {
			status: 204,
			headers: { ...cors, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' },
		});
	}
	if (request.method !== 'POST' || new URL(request.url).pathname !== '/') return json(405, { erro: 'só POST em /' }, cors);

	// o limite vem antes de ler o corpo, para o abuso custar o mínimo
	const ip = request.headers.get('CF-Connecting-IP') ?? 'sem-ip';
	if (!(await env.LIMITE.limit({ key: ip })).success) return json(429, { erro: 'pedidos demais' }, { ...cors, 'Retry-After': '60' });

	const text = await request.text();
	if (text.length > REQUEST_MAX_BYTES) return json(413, { erro: 'pedido grande demais' }, cors);
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		return json(400, { erro: 'pedido inválido' }, cors);
	}
	const parsed = parseRequest(value);
	if (!parsed.ok) return json(400, { erro: parsed.erro }, cors);

	const { endpoint, ttl, urgency, authorization } = parsed.request;
	let res: Response;
	try {
		res = await forward(endpoint, {
			method: 'POST',
			headers: {
				TTL: String(ttl),
				Urgency: urgency,
				Authorization: authorization,
				'Content-Encoding': 'aes128gcm',
				'Content-Type': 'application/octet-stream',
			},
			body: parsed.body,
			// redirecionamento levaria o pedido para fora da lista de serviços
			redirect: 'manual',
			signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
		});
	} catch {
		return json(502, { erro: 'serviço de push não respondeu' }, cors);
	}
	const resposta = (await res.text()).slice(0, ANSWER_MAX_CHARS);
	return json(200, { status: res.status, resposta } satisfies PushRelayResult, cors);
}
