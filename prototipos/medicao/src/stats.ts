export type Summary = { n: number; median: number; p95: number; min: number; max: number }

export function summarize(samples: number[]): Summary {
  const s = [...samples].sort((a, b) => a - b)
  const at = (q: number) => s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)]
  return { n: s.length, median: at(0.5), p95: at(0.95), min: s[0], max: s[s.length - 1] }
}

export const ms = (v: number) => `${v < 10 ? v.toFixed(2) : Math.round(v)} ms`
