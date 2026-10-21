import { defineConfig } from 'vite'

// base relativo: o mesmo build funciona em qualquer subcaminho do GitHub Pages
export default defineConfig({
  base: './',
  worker: { format: 'es' },
})
