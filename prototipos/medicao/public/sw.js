// Acrescenta os cabeçalhos de isolamento (COOP/COEP) que o GitHub Pages não permite
// configurar. Com eles, a página fica crossOriginIsolated e o Chrome libera
// performance.measureUserAgentSpecificMemory(), que mede JavaScript e DOM juntos.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return
  e.respondWith(
    fetch(req).then((res) => {
      if (res.status === 0) return res
      const headers = new Headers(res.headers)
      headers.set('Cross-Origin-Opener-Policy', 'same-origin')
      headers.set('Cross-Origin-Embedder-Policy', 'require-corp')
      headers.set('Cross-Origin-Resource-Policy', 'cross-origin')
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
    }),
  )
})
