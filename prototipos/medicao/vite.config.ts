import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// base relativo: o mesmo build funciona em qualquer subcaminho do GitHub Pages
export default defineConfig({
  base: './',
  plugins: [svelte()],
  worker: { format: 'es' },
  build: {
    rolldownOptions: {
      input: { index: 'index.html', rolagem: 'rolagem.html' },
    },
  },
})
