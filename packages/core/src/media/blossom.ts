// Cliente Blossom (BUD-01/02): envia arquivos cifrados e baixa pelo hash.
// Servidores testados em prototipos/relays: aceitam binário opaco e têm CORS.

import type { EventTemplate, NostrEvent } from 'nostr-tools/pure';

export type BlossomSigner = (template: EventTemplate) => Promise<NostrEvent>;

/** Quantos servidores recebem cada arquivo (ADR-0004: redundância). */
export const COPIES = 2;
const TIMEOUT_MS = 30_000;

export class BlossomError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'BlossomError';
	}
}

function withTimeout(ms: number) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), ms);
	return { signal: controller.signal, done: () => clearTimeout(timer) };
}

async function authHeader(signer: BlossomSigner, x: string): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const event = await signer({
		kind: 24242,
		created_at: now,
		tags: [
			['t', 'upload'],
			['x', x],
			['expiration', String(now + 600)]
		],
		content: 'Lero-lero: envio de mídia cifrada'
	});
	// base64 de UTF-8, sem depender de Buffer (roda no navegador)
	const bytes = new TextEncoder().encode(JSON.stringify(event));
	let binary = '';
	for (const b of bytes) binary += String.fromCharCode(b);
	return `Nostr ${btoa(binary)}`;
}

async function uploadOne(server: string, data: Uint8Array<ArrayBuffer>, x: string, signer: BlossomSigner): Promise<string> {
	const t = withTimeout(TIMEOUT_MS);
	try {
		const res = await fetch(`${server}/upload`, {
			method: 'PUT',
			headers: { Authorization: await authHeader(signer, x), 'Content-Type': 'application/octet-stream', 'X-SHA-256': x },
			body: data,
			signal: t.signal
		});
		if (!res.ok) throw new BlossomError(`${server} recusou (${res.status}): ${res.headers.get('x-reason') ?? ''}`.trim());
		const descriptor = (await res.json()) as { url?: string; sha256?: string };
		if (descriptor.sha256 && descriptor.sha256 !== x) throw new BlossomError(`${server} guardou outro arquivo`);
		return descriptor.url ?? `${server}/${x}`;
	} finally {
		t.done();
	}
}

/**
 * Envia para `COPIES` servidores ao mesmo tempo, na ordem da lista; quem falhar é
 * substituído pelo próximo da lista (as reservas). Devolve as URLs; falha só se nenhum aceitar.
 */
export async function upload(servers: string[], data: Uint8Array<ArrayBuffer>, x: string, signer: BlossomSigner): Promise<string[]> {
	const urls: string[] = [];
	const errors: string[] = [];
	const queue = servers.map((s) => s.replace(/\/+$/, ''));
	while (urls.length < COPIES && queue.length > 0) {
		const wave = queue.splice(0, COPIES - urls.length);
		const results = await Promise.allSettled(wave.map((server) => uploadOne(server, data, x, signer)));
		for (const r of results) {
			if (r.status === 'fulfilled') urls.push(r.value);
			else errors.push(r.reason instanceof Error ? r.reason.message : String(r.reason));
		}
	}
	if (urls.length === 0) throw new BlossomError(`nenhum servidor aceitou o arquivo: ${errors.join('; ')}`);
	return urls;
}

/** Baixa do primeiro endereço que responder com o arquivo certo (hash `x`). */
export async function download(urls: string[], x: string): Promise<Uint8Array<ArrayBuffer>> {
	for (const url of urls) {
		const t = withTimeout(TIMEOUT_MS);
		try {
			const res = await fetch(url, { signal: t.signal });
			if (!res.ok) continue;
			return new Uint8Array(await res.arrayBuffer());
		} catch {
			// servidor fora do ar: tenta o próximo
		} finally {
			t.done();
		}
	}
	throw new BlossomError(`não foi possível baixar o arquivo ${x.slice(0, 8)}…`);
}
