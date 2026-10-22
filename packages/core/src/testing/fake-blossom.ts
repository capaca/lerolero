// Servidor Blossom em memória para testes (BUD-01/02): PUT /upload com autorização
// kind 24242, GET /<sha256>. Dá para simular recusa e arquivo adulterado.

import { createServer, type Server } from 'node:http';
import { createHash } from 'node:crypto';
import { verifyEvent, type NostrEvent } from 'nostr-tools/pure';

export class FakeBlossom {
	readonly files = new Map<string, Buffer>();
	uploads = 0;
	rejectUploads = false;
	/** devolve bytes trocados no download (servidor malicioso) */
	tamper = false;
	private server?: Server;
	private port = 0;

	get url() {
		return `http://127.0.0.1:${this.port}`;
	}

	async start(): Promise<this> {
		this.server = createServer((req, res) => void this.handle(req, res));
		await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', resolve));
		this.port = (this.server.address() as { port: number }).port;
		return this;
	}

	async stop() {
		await new Promise<void>((resolve) => this.server?.close(() => resolve()));
	}

	private async handle(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) {
		const path = new URL(req.url!, 'http://x').pathname;
		if (req.method === 'PUT' && path === '/upload') {
			const chunks: Buffer[] = [];
			for await (const c of req) chunks.push(c as Buffer);
			const body = Buffer.concat(chunks);
			const sha = createHash('sha256').update(body).digest('hex');
			const auth = String(req.headers.authorization ?? '');
			let event: NostrEvent | undefined;
			try {
				event = JSON.parse(Buffer.from(auth.replace(/^Nostr /, ''), 'base64').toString('utf8'));
			} catch {}
			const ok =
				event &&
				verifyEvent(event) &&
				event.kind === 24242 &&
				event.tags.some((t) => t[0] === 't' && t[1] === 'upload') &&
				event.tags.some((t) => t[0] === 'x' && t[1] === sha) &&
				Number(event.tags.find((t) => t[0] === 'expiration')?.[1]) > Date.now() / 1000;
			if (this.rejectUploads || !ok) {
				res.writeHead(this.rejectUploads ? 415 : 401, { 'x-reason': this.rejectUploads ? 'tipo não aceito' : 'autorização inválida' });
				return res.end();
			}
			this.uploads++;
			this.files.set(sha, body);
			res.writeHead(200, { 'content-type': 'application/json' });
			return res.end(JSON.stringify({ url: `${this.url}/${sha}`, sha256: sha, size: body.length }));
		}
		if (req.method === 'DELETE') {
			const sha = path.slice(1);
			let event: NostrEvent | undefined;
			try {
				event = JSON.parse(Buffer.from(String(req.headers.authorization ?? '').replace(/^Nostr /, ''), 'base64').toString('utf8'));
			} catch {}
			const ok =
				event &&
				verifyEvent(event) &&
				event.kind === 24242 &&
				event.tags.some((t) => t[0] === 't' && t[1] === 'delete') &&
				event.tags.some((t) => t[0] === 'x' && t[1] === sha);
			if (!ok) {
				res.writeHead(401);
				return res.end();
			}
			this.files.delete(sha);
			res.writeHead(200);
			return res.end();
		}
		if (req.method === 'GET') {
			const file = this.files.get(path.slice(1));
			if (!file) {
				res.writeHead(404);
				return res.end();
			}
			res.writeHead(200, { 'content-type': 'application/octet-stream' });
			return res.end(this.tamper ? Buffer.from(file.map((b) => b ^ 1)) : file);
		}
		res.writeHead(405);
		res.end();
	}
}
