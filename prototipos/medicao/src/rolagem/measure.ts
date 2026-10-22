import { summarize, type Summary } from '../stats'

export type ScrollResult = {
  durationMs: number
  distancePx: number
  frames: number
  fps: number
  frameTime: Summary
  /**
   * Frequência da tela: o menor período entre a tela parada (antes de rolar) e o
   * 10º percentil dos quadros durante a rolagem. Só a rolagem engana quando quase
   * todos os quadros atrasam; só a tela parada engana se a taxa variável subir ao rolar.
   */
  refreshHz: number
  /** quadros entregues ÷ quadros que a tela pediu, em %: comparável entre frequências */
  smoothnessPct: number
  /** quadros que atrasaram pelo menos um ciclo da tela, em % */
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

  const idle: number[] = []
  let prev = await nextFrame()
  for (let i = 0; i < 30; i++) {
    const t = await nextFrame()
    idle.push(t - prev)
    prev = t
  }

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
    // uma pausa longa não pode pular metade da conversa de uma vez
    carry += (pxPerSecond * Math.min(dt, 100)) / 1000
    const step = Math.floor(carry)
    carry -= step
    el.scrollTop -= step
    moved += step
  }
  observer?.disconnect()

  const durationMs = last - t0
  const frameTime = summarize(deltas)
  const period = Math.min(summarize(idle).median, [...deltas].sort((a, b) => a - b)[Math.floor(deltas.length * 0.1)])
  const missed = deltas.map((d) => Math.max(0, Math.round(d / period) - 1))
  const totalMissed = missed.reduce((a, b) => a + b, 0)
  return {
    durationMs,
    distancePx: moved,
    frames: deltas.length,
    fps: deltas.length / (durationMs / 1000),
    frameTime,
    refreshHz: Math.round(1000 / period),
    smoothnessPct: (100 * deltas.length) / (deltas.length + totalMissed),
    droppedPct: (100 * missed.filter((m) => m > 0).length) / deltas.length,
    janks: deltas.filter((d) => d > 50).length,
    longTasks,
  }
}
