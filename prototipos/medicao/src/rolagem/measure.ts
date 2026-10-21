import { summarize, type Summary } from '../stats'

export type ScrollResult = {
  durationMs: number
  distancePx: number
  frames: number
  fps: number
  frameTime: Summary
  /** quadros acima de 25 ms (perdeu pelo menos um quadro a 60 Hz) */
  droppedPct: number
  /** quadros acima de 50 ms: engasgo perceptível */
  janks: number
  longTasks: number
}

const nextFrame = () => new Promise<number>((r) => requestAnimationFrame(r))

/** Espera a próxima pintura: o segundo rAF roda depois que o primeiro quadro foi desenhado. */
export async function afterPaint() {
  await nextFrame()
  await nextFrame()
}

/**
 * Rola para cima a partir do fim da conversa, como quem volta no histórico,
 * movendo scrollTop a cada quadro numa velocidade constante.
 *
 * Mede o custo da thread principal (layout, pintura e o trabalho da lista).
 * A rolagem real com o dedo roda em parte no compositor e tende a ser mais
 * suave do que isto, então o resultado é um limite pessimista.
 */
export async function scrollUp(el: HTMLElement, pxPerSecond: number, maxDistance: number): Promise<ScrollResult> {
  let longTasks = 0
  let observer: PerformanceObserver | undefined
  try {
    observer = new PerformanceObserver((list) => (longTasks += list.getEntries().length))
    observer.observe({ type: 'longtask' })
  } catch {}

  // relativo à posição atual: a lista virtualizada pode corrigir scrollTop entre quadros
  const deltas: number[] = []
  let last = await nextFrame()
  const t0 = last
  let moved = 0
  let carry = 0
  while (el.scrollTop > 0 && moved < maxDistance) {
    const now = await nextFrame()
    const dt = now - last
    last = now
    deltas.push(dt)
    carry += (pxPerSecond * dt) / 1000
    const step = Math.floor(carry)
    carry -= step
    el.scrollTop -= step
    moved += step
  }
  observer?.disconnect()

  const durationMs = last - t0
  return {
    durationMs,
    distancePx: moved,
    frames: deltas.length,
    fps: deltas.length / (durationMs / 1000),
    frameTime: summarize(deltas),
    droppedPct: (100 * deltas.filter((d) => d > 25).length) / deltas.length,
    janks: deltas.filter((d) => d > 50).length,
    longTasks,
  }
}
