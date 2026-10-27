import { paraglideVitePlugin } from '@inlang/paraglide-js';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// No GitHub Pages o app fica em /lerolero; o CI define BASE_PATH. Localmente, raiz.
const base = (process.env.BASE_PATH ?? '') as '' | `/${string}`;
// build:pseudo: os textos na pseudolíngua (scripts/pseudolingua.js), para o teste de textos fixos (ADR-0008)
const pseudo = !!process.env.LINGUA_PSEUDO;
const out = pseudo ? 'build-pseudo' : 'build';

export default defineConfig({
	// número da release (SemVer), definido pelo workflow de release; fora dele, "dev".
	// O `version` do SvelteKit continua sendo o do build e nomeia o cache do service worker.
	// APP_AMBIENTE=homologacao marca o app da homologação (ADR-0007), para não confundir com a produção.
	define: {
		__APP_RELEASE__: JSON.stringify(process.env.APP_RELEASE ?? 'dev'),
		__APP_HOMOLOG__: JSON.stringify(process.env.APP_AMBIENTE === 'homologacao')
	},
	plugins: [
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
});
