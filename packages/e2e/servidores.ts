// Sobe o que o app precisa, tudo local: dois relays Nostr, um Blossom e um servidor estático que imita o
// GitHub Pages (404.html para caminho desconhecido). O relays.json servido aponta para os servidores
// locais, e por ser mais novo que o embutido o app passa a usá-lo.
import { createServer, type Server } from 'node:http';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { FakeBlossom } from '../core/src/testing/fake-blossom.ts';
import { FakeRelay } from '../core/src/testing/fake-relay.ts';

const PORT = 4190;
export const APP_URL = `http://127.0.0.1:${PORT}/lerolero/`;
const BUILD = new URL('../app/build/', import.meta.url).pathname;
/** O mesmo app com os textos na pseudolíngua (`pnpm build:pseudo`), para o teste de textos fixos (ADR-0008). */
export const PSEUDO_URL = `http://127.0.0.1:${PORT}/lerolero-pseudo/`;
const BUILD_PSEUDO = new URL('../app/build-pseudo/', import.meta.url).pathname;

/** Qual build serve o caminho pedido: o da pseudolíngua ou o normal. */
function site(path: string): { prefix: string; dir: string } | undefined {
	for (const [prefix, dir] of [['/lerolero-pseudo', BUILD_PSEUDO], ['/lerolero', BUILD]]) {
		if (path === prefix || path.startsWith(prefix + '/')) return { prefix, dir };
	}
}

const TYPES: Record<string, string> = {
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.webmanifest': 'application/manifest+json',
	'.wasm': 'application/wasm'
};

async function isFile(path: string) {
	return stat(path).then(
		(s) => s.isFile(),
		() => false
	);
}

/** O app como no GitHub Pages; `versao` muda o service worker, como uma publicação nova (atualizacao.spec.ts). */
export function pagesServer(relays: string, opcoes: { versao?: () => string | undefined } = {}) {
	return createServer(async (req, res) => {
		const path = decodeURIComponent(new URL(req.url!, 'http://x').pathname);
		const app = site(path);
		if (app && path === `${app.prefix}/relays.json`) {
			res.writeHead(200, { 'content-type': 'application/json' });
			return res.end(relays);
		}
		let file = app ? join(app.dir, path.slice(app.prefix.length)) : '';
		if (app && !(await isFile(file))) {
			file = (await isFile(file + '.html')) ? file + '.html' : join(file, 'index.html');
		}
		if (app && (await isFile(file))) {
			res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
			let body = await readFile(file);
			// "versão nova publicada": o service worker muda um byte e o navegador o instala
			const versao = opcoes.versao?.();
			if (versao && path === `${app.prefix}/service-worker.js`) body = Buffer.concat([body, Buffer.from(`\n// ${versao}\n`)]);
			return res.end(body);
		}
		res.writeHead(404, { 'content-type': 'text/html' });
		res.end(await readFile(join(app?.dir ?? BUILD, '404.html')));
	});
}

/** Certificado autoassinado para os Blossom: o app só aceita mídia em https (o navegador da suíte ignora o emissor). */
function selfSignedCert() {
	const dir = mkdtempSync(join(tmpdir(), 'lerolero-e2e-'));
	const [key, cert] = [join(dir, 'key.pem'), join(dir, 'cert.pem')];
	execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '2', '-subj', '/CN=127.0.0.1'], {
		stdio: 'ignore'
	});
	return { key: readFileSync(key, 'utf8'), cert: readFileSync(cert, 'utf8') };
}

export default async function globalSetup() {
	if (!existsSync(join(BUILD, '404.html'))) {
		throw new Error('Falta o build do app: rode `BASE_PATH=/lerolero pnpm build` na raiz antes da suíte.');
	}
	if (!existsSync(join(BUILD_PSEUDO, '404.html'))) {
		throw new Error('Falta o build da pseudolíngua: rode `pnpm build:pseudo` em packages/app antes da suíte.');
	}
	// dois Blossom, como em produção: o app guarda cada arquivo em dois servidores
	const tls = selfSignedCert();
	const [dm, geral, blossom1, blossom2] = await Promise.all([
		new FakeRelay().start(),
		new FakeRelay().start(),
		new FakeBlossom(tls).start(),
		new FakeBlossom(tls).start()
	]);
	const relays = JSON.stringify({
		versao: 1,
		atualizado: '9999-12-31',
		dm: [dm.url],
		geral: [geral.url],
		blossom: [blossom1.url, blossom2.url]
	});
	const server: Server = pagesServer(relays);
	await new Promise<void>((resolve) => server.listen(PORT, '127.0.0.1', resolve));
	return async () => {
		server.close();
		await Promise.all([dm.stop(), geral.stop(), blossom1.stop(), blossom2.stop()]);
	};
}
