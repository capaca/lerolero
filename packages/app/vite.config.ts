import { paraglideVitePlugin } from '@inlang/paraglide-js';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

// No GitHub Pages o app fica em /lerolero; o CI define BASE_PATH. Localmente, raiz.
const base = (process.env.BASE_PATH ?? '') as '' | `/${string}`;
// build:pseudo: os textos na pseudolíngua (scripts/pseudolingua.js), para o teste de textos fixos (ADR-0008)
const pseudo = !!process.env.LINGUA_PSEUDO;
const out = pseudo ? 'build-pseudo' : 'build';

/** Cor do app em dev (`vite dev`, scripts/celular.sh): roxo, para o instalado no celular não parecer a produção. */
const LOCAL_COLOR = '#7c3aed';

/**
 * Em dev, o manifest sai com outro nome e outra cor, como a homologação faz no workflow: instalado no celular, o
 * "Lero local" fica ao lado do de verdade sem confundir (outra origem, outros dados).
 */
const localManifest = (): Plugin => ({
	name: 'lerolero-manifest-local',
	apply: 'serve',
	configureServer(server) {
		server.middlewares.use('/manifest.webmanifest', (_req, res) => {
			const manifest = JSON.parse(readFileSync(new URL('./static/manifest.webmanifest', import.meta.url), 'utf8'));
			Object.assign(manifest, { name: 'Lero-lero (local)', short_name: 'Lero local', theme_color: LOCAL_COLOR });
			res.setHeader('Content-Type', 'application/manifest+json');
			res.end(JSON.stringify(manifest, null, '\t'));
		});
	}
});

export default defineConfig(({ command }) => ({
	// número da release (SemVer), definido pelo workflow de release; fora dele, "dev".
	// O `version` do SvelteKit continua sendo o do build e nomeia o cache do service worker.
	// APP_AMBIENTE=homologacao marca o app da homologação (ADR-0007), para não confundir com a produção.
	define: {
		__APP_RELEASE__: JSON.stringify(process.env.APP_RELEASE ?? 'dev'),
		__APP_HOMOLOG__: JSON.stringify(process.env.APP_AMBIENTE === 'homologacao'),
		// `vite dev`: o app local, com moldura e nome próprios
		__APP_LOCAL__: JSON.stringify(command === 'serve'),
		__APP_LOCAL_COLOR__: JSON.stringify(LOCAL_COLOR)
	},
	plugins: [
		localManifest(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// SPA estático (ADR-0002): sem servidor. O GitHub Pages devolve 404.html para
			// qualquer caminho desconhecido, então ele vira a página de entrada do app.
			adapter: adapter({ pages: out, assets: out, fallback: '404.html' }),
			paths: { base }
		}),
		// textos da interface (ADR-0008); as opções ficam em project.inlang/paraglide.config.js
		paraglideVitePlugin({ project: pseudo ? './.pseudo/project.inlang' : './project.inlang' })
	]
}));
