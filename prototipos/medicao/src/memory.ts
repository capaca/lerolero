/**
 * Garante o isolamento de origem cruzada via service worker (public/sw.js).
 * Na primeira visita, o worker ainda não controla a página: registra e recarrega uma vez.
 * Se a página já está controlada e mesmo assim não ficou isolada, o navegador não
 * suporta: segue sem a medição de memória, sem entrar em laço.
 */
export async function ensureIsolated(): Promise<boolean> {
  if (crossOriginIsolated) return true
  if (!('serviceWorker' in navigator)) return false
  try {
    await navigator.serviceWorker.register('./sw.js')
    if (navigator.serviceWorker.controller) return false
    await navigator.serviceWorker.ready
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
