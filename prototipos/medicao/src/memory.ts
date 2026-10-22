const RELOAD_FLAG = 'lerolero.medicao.recarregou'

/**
 * Garante o isolamento de origem cruzada via service worker (public/sw.js).
 * Na primeira visita, o worker ainda não controla a página: registra e recarrega uma vez.
 * A página pode estar controlada por outro worker (o do app, cujo escopo é o site
 * inteiro); nesse caso também recarrega, para o nosso, de escopo mais específico, assumir.
 * Recarrega no máximo uma vez por sessão: se mesmo assim não isolar, o navegador
 * não suporta e a página segue sem a medição de memória.
 */
export async function ensureIsolated(): Promise<boolean> {
  if (crossOriginIsolated) return true
  if (!('serviceWorker' in navigator)) return false
  try {
    const registration = await navigator.serviceWorker.register('./sw.js')
    const ours = navigator.serviceWorker.controller?.scriptURL === new URL('./sw.js', location.href).href
    if (ours || sessionStorage.getItem(RELOAD_FLAG)) return false
    sessionStorage.setItem(RELOAD_FLAG, '1')
    await new Promise<void>((resolve) => {
      const worker = registration.installing ?? registration.waiting ?? registration.active
      if (!worker || worker.state === 'activated') return resolve()
      worker.addEventListener('statechange', () => worker.state === 'activated' && resolve())
    })
    location.reload()
    return new Promise(() => {}) // a página vai recarregar
  } catch {
    return false
  }
}

/** Memória da página (JavaScript + DOM) em MB, ou undefined se o navegador não mede. */
export async function pageMemoryMB(): Promise<number | undefined> {
  const measure = (performance as any).measureUserAgentSpecificMemory
  if (!crossOriginIsolated || !measure) return undefined
  try {
    const result = await measure.call(performance)
    return Math.round(result.bytes / 1048576)
  } catch {
    return undefined
  }
}
