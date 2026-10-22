// Guarda o app no aparelho para abrir sem internet (offline primeiro, RNF-33).
// Baseado no exemplo da documentação do SvelteKit 3.
import { self } from '$app/service-worker';
import { version } from '$app/env';
import { immutable, assets, prerendered } from '$app/manifest';
import { resolve } from '$app/paths';

const CACHE_NAME = `lerolero-${version}`;

// os caminhos do manifesto são relativos à raiz do app (/lerolero no GitHub Pages)
const ROOT = resolve('/');
const at = (path: string) => ROOT + path.replace(/^\//, '');

// relays.json vem sempre da rede primeiro, para mudar sem nova versão (RNF-36);
// a cópia guardada só é usada sem conexão
const RELAYS = at('relays.json');
// página de entrada para rotas sem página própria (o adapter gera com caminhos absolutos)
const FALLBACK = at('404.html');
const PRECACHE: string[] = [...immutable, ...assets, ...prerendered]
	.map((file) => at(file.path))
	.filter((path) => path !== RELAYS);

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE_NAME);
			await cache.addAll([...PRECACHE, RELAYS, FALLBACK]);
			// assume já, sem esperar todas as janelas fecharem: num app instalado no Android
			// elas quase nunca fecham, e a versão nova ficaria parada; a página avisa e recarrega
			await self.skipWaiting();
		})()
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE_NAME) await caches.delete(key);
			}
			// assume a página já na primeira visita, sem esperar uma recarga
			await self.clients.claim();
		})()
	);
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;
	const url = new URL(event.request.url);
	if (url.origin !== self.location.origin) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE_NAME);

			if (PRECACHE.includes(url.pathname)) {
				const cached = await cache.match(url.pathname);
				if (cached) return cached;
			}

			// o resto vem da rede; a cópia guardada só serve quando não há conexão
			try {
				const response = await fetch(event.request);
				if (response.status === 200) void cache.put(event.request, response.clone());
				return response;
			} catch (error) {
				const cached = await cache.match(event.request);
				if (cached) return cached;
				// navegação offline para um caminho não guardado: abre o app pela entrada
				if (event.request.mode === 'navigate') {
					const shell = await cache.match(FALLBACK);
					if (shell) return shell;
				}
				throw error;
			}
		})()
	);
});
