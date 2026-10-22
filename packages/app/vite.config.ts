import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// No GitHub Pages o app fica em /lerolero; o CI define BASE_PATH. Localmente, raiz.
const base = (process.env.BASE_PATH ?? '') as '' | `/${string}`;

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// SPA estático (ADR-0002): sem servidor. O GitHub Pages devolve 404.html para
			// qualquer caminho desconhecido, então ele vira a página de entrada do app.
			adapter: adapter({ fallback: '404.html' }),
			paths: { base }
		})
	]
});
