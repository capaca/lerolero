// Service worker do destinatário: acorda com o push, anota quando chegou e mostra a notificação.
// No app, o aviso só diz "acorde" e quem mandou; o conteúdo nunca vai nele (ADR-0005).
importScripts('banco.js')

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      const recebidoEm = Date.now()
      let aviso
      try {
        aviso = event.data.json()
      } catch {
        aviso = { id: `sem-dados-${recebidoEm}`, erro: event.data ? 'não é JSON' : 'sem dados' }
      }
      // com a janela aberta o teste não vale para "app fechado"; anotar em vez de confiar na memória
      const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      let nomeNoAparelho = null
      try {
        nomeNoAparelho = (await self.banco.get('contatos', aviso.contato ?? ''))?.nome ?? null
      } catch (err) {
        nomeNoAparelho = `erro: ${err}`
      }
      await self.banco.put('recebidos', {
        ...aviso,
        recebidoEm,
        atrasoMs: aviso.enviadoEm ? recebidoEm - aviso.enviadoEm : null,
        janelasAbertas: janelas.length,
        janelaVisivel: janelas.some((c) => c.visibilityState === 'visible'),
        nomeNoAparelho,
      })
      const nome = nomeNoAparelho ?? aviso.de ?? 'alguém'
      await self.registration.showNotification(`Mensagem de ${nome}`, {
        body: 'Toque para abrir o Lero-lero (teste de notificação)',
        icon: '../icon-192.png',
        tag: aviso.id,
        data: { url: self.registration.scope },
      })
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      if (janelas[0]) return janelas[0].focus()
      return self.clients.openWindow(event.notification.data.url)
    })(),
  )
})

// O navegador pode trocar a inscrição sozinho; no app, isso pediria mandar o cartão de perfil de novo
self.addEventListener('pushsubscriptionchange', (event) => {
  const agora = Date.now()
  const troca = { id: `troca-${agora}`, evento: 'pushsubscriptionchange', recebidoEm: agora }
  event.waitUntil(self.banco.put('recebidos', troca))
})
