import './style.css'
import type { Task } from './worker'
import { measureRelay, type RelayResult } from './relays'
import { ms, type Summary } from './stats'

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.0xchat.com',
  'wss://auth.nostr1.com',
]
const RELAYS_KEY = 'lerolero.medicao.relays'

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!
const report: Record<string, unknown> = { versao: 1, data: new Date().toISOString() }

// ---------- Worker ----------

const workerStart = performance.now()
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>()
let nextId = 1
const workerReady = new Promise<number>((resolve) => {
  worker.addEventListener('message', function onReady(e) {
    if (e.data?.ready) {
      worker.removeEventListener('message', onReady)
      resolve(performance.now() - workerStart)
    }
  })
})
worker.addEventListener('message', ({ data }) => {
  const p = pending.get(data.id)
  if (!p) return
  pending.delete(data.id)
  data.ok ? p.resolve(data.result) : p.reject(new Error(data.error))
})

function runTask<T>(task: Task): Promise<T> {
  const id = nextId++
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    worker.postMessage({ id, task })
  })
}

// ---------- Ambiente ----------

function heapMB(): number | undefined {
  const mem = (performance as any).memory
  return mem ? Math.round(mem.usedJSHeapSize / 1048576) : undefined
}

async function environment() {
  const nav = navigator as any
  // loadEventEnd só é preenchido depois que o evento load termina
  if (document.readyState !== 'complete') await new Promise((r) => addEventListener('load', r, { once: true }))
  await new Promise((r) => setTimeout(r))
  const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  const env = {
    userAgent: navigator.userAgent,
    memoriaDoAparelhoGB: nav.deviceMemory,
    nucleos: navigator.hardwareConcurrency,
    rede: nav.connection?.effectiveType,
    paginaCarregadaMs: timing ? Math.round(timing.loadEventEnd || timing.domContentLoadedEventEnd) : undefined,
    workerProntoMs: Math.round(await workerReady),
    heapInicialMB: heapMB(),
  }
  report.ambiente = env
  $('#env').innerHTML = rows([
    ['Navegador', env.userAgent],
    ['Memória do aparelho', env.memoriaDoAparelhoGB ? `${env.memoriaDoAparelhoGB} GB (aprox.)` : 'não informada'],
    ['Núcleos', String(env.nucleos)],
    ['Rede', env.rede ?? 'não informada'],
    ['Página carregada', env.paginaCarregadaMs !== undefined ? ms(env.paginaCarregadaMs) : '—'],
    ['Worker pronto', ms(env.workerProntoMs)],
    ['Heap JS', env.heapInicialMB !== undefined ? `${env.heapInicialMB} MB` : 'não disponível neste navegador'],
  ])
}

// ---------- Testes ----------

type Check = { label: string; target: string; pass: boolean | undefined }

function rows(items: [string, string][]): string {
  return items.map(([k, v]) => `<tr><th>${k}</th><td>${escape(v)}</td></tr>`).join('')
}

function escape(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}

function summaryText(s: Summary) {
  return `mediana ${ms(s.median)} · p95 ${ms(s.p95)} (n=${s.n})`
}

function badge(pass: boolean | undefined) {
  if (pass === undefined) return '<span class="badge">—</span>'
  return pass ? '<span class="badge ok">dentro da meta</span>' : '<span class="badge fail">fora da meta</span>'
}

function renderChecks(el: HTMLElement, items: [string, string][], checks: Check[] = []) {
  el.innerHTML =
    `<table>${rows(items)}</table>` +
    (checks.length
      ? `<ul class="checks">${checks.map((c) => `<li>${badge(c.pass)} ${c.label} — meta ${c.target}</li>`).join('')}</ul>`
      : '')
}

async function testNip17() {
  const el = $('#nip17-out')
  el.textContent = 'Medindo…'
  const r = await runTask<{ wrap: Summary; unwrap: Summary; wrapBytes: number; overheadBytes: number }>({
    kind: 'nip17',
    runs: 30,
  })
  report.nip17 = r
  renderChecks(
    el,
    [
      ['Cifrar (2 gift wraps)', summaryText(r.wrap)],
      ['Decifrar (1 gift wrap)', summaryText(r.unwrap)],
      ['Tamanho do gift wrap', `${r.wrapBytes} bytes (${r.overheadBytes} além do texto)`],
    ],
    [
      { label: 'Envio aparece na tela (cifrar cabe folgado)', target: '< 100 ms (RNF-12)', pass: r.wrap.p95 < 100 },
      { label: 'Peso extra por mensagem', target: '< 2 KB (RNF-21)', pass: r.overheadBytes < 2048 },
    ],
  )
}

async function testArgon2() {
  const el = $('#argon2-out')
  const items: [string, string][] = []
  const out: Record<string, unknown> = {}
  for (const impl of ['wasm', 'noble'] as const) {
    el.textContent = `Medindo ${impl}…`
    const heapBefore = heapMB()
    const r = await runTask<{ params: unknown; time: Summary }>({ kind: 'argon2', impl, runs: 3 })
    out[impl] = { ...r, heapAntesMB: heapBefore, heapDepoisMB: heapMB() }
    out.params = r.params
    items.push([impl === 'wasm' ? 'hash-wasm (WebAssembly)' : '@noble/hashes (JS puro)', summaryText(r.time)])
  }
  report.argon2 = out
  const best = Math.min(...(['wasm', 'noble'] as const).map((k) => (out[k] as { time: Summary }).time.median))
  items.unshift(['Parâmetros', '19 MiB, 2 iterações, paralelismo 1'])
  renderChecks(el, items, [{ label: 'Desbloquear com o PIN (melhor implementação)', target: '~1 s (docs/06 §2)', pass: best <= 1500 }])
}

async function testPow() {
  const el = $('#pow-out')
  el.textContent = 'Medindo… (pode levar alguns minutos)'
  const r = await runTask<{ levels: { difficulty: number; time: Summary }[] }>({
    kind: 'pow',
    difficulties: [8, 12, 14, 16, 18, 20],
    maxRunsPerLevel: 10,
    budgetMs: 20_000,
  })
  report.pow = r
  // a prova de trabalho é sorteio: a mediana esconde os envios azarados, então a meta vale para o p95
  const under1s = r.levels.filter((l) => l.time.p95 < 1000).map((l) => l.difficulty)
  renderChecks(
    el,
    r.levels.map((l) => [`Dificuldade ${l.difficulty}`, summaryText(l.time)]),
    [
      {
        label: `Maior dificuldade com p95 < 1 s: ${under1s.length ? Math.max(...under1s) : 'nenhuma'}`,
        target: '< 1 s (RNF-18)',
        pass: under1s.length > 0,
      },
    ],
  )
}

function loadRelays(): string[] {
  try {
    const saved = localStorage.getItem(RELAYS_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  return DEFAULT_RELAYS
}

function saveRelays(list: string[]) {
  try {
    localStorage.setItem(RELAYS_KEY, JSON.stringify(list))
  } catch {}
}

async function testRelays() {
  const el = $('#relays-out')
  const list = $<HTMLTextAreaElement>('#relays').value.split(/\s+/).filter((u) => u.startsWith('wss://'))
  saveRelays(list)
  const roundTrip = $<HTMLInputElement>('#roundtrip').checked
  el.textContent = 'Conectando…'
  const results: RelayResult[] = await Promise.all(list.map((url) => measureRelay(url, roundTrip)))
  report.relays = { idaEVolta: roundTrip, resultados: results }
  const fmt = (v?: number) => (v === undefined ? '—' : ms(v))
  el.innerHTML = `<table class="grid">
    <tr><th>Relay</th><th>Conexão</th><th>EOSE</th><th>Ida e volta</th><th>NIP-42</th></tr>
    ${results
      .map(
        (r) => `<tr><td>${escape(r.url.replace('wss://', ''))}${r.error ? `<div class="err">${escape(r.error)}</div>` : ''}</td>
        <td>${fmt(r.connectMs)}</td><td>${fmt(r.eoseMs)}</td>
        <td class="${r.roundTripMs === undefined ? '' : r.roundTripMs < 2000 ? 'good' : 'bad'}">${fmt(r.roundTripMs)}</td>
        <td>${r.auth ? 'sim' : '—'}</td></tr>`,
      )
      .join('')}
  </table><p class="hint">Meta de entrega com os dois online: &lt; 2 s em 95% dos casos (RNF-13).</p>`
}

// ---------- Ligação dos botões ----------

async function guarded(btn: HTMLButtonElement, fn: () => Promise<void>, out: HTMLElement) {
  btn.disabled = true
  try {
    await fn()
  } catch (err) {
    out.innerHTML = `<p class="err">Erro: ${escape(String(err))}</p>`
    // fica no JSON copiado: sem isso, um teste que falha simplesmente some do relatório
    ;((report.erros ??= {}) as Record<string, string>)[out.id.replace('-out', '')] = String(err)
  } finally {
    btn.disabled = false
  }
}

const tests: [string, () => Promise<void>, string][] = [
  ['#nip17-btn', testNip17, '#nip17-out'],
  ['#argon2-btn', testArgon2, '#argon2-out'],
  ['#pow-btn', testPow, '#pow-out'],
  ['#relays-btn', testRelays, '#relays-out'],
]
for (const [btn, fn, out] of tests) {
  $<HTMLButtonElement>(btn).addEventListener('click', (e) => guarded(e.currentTarget as HTMLButtonElement, fn, $(out)))
}

$<HTMLButtonElement>('#all-btn').addEventListener('click', async (e) => {
  const btn = e.currentTarget as HTMLButtonElement
  btn.disabled = true
  for (const [testBtn, fn, out] of tests) await guarded($(testBtn), fn, $(out))
  btn.disabled = false
})

$<HTMLButtonElement>('#copy-btn').addEventListener('click', async () => {
  report.heapFinalMB = heapMB()
  const json = JSON.stringify(report, null, 2)
  try {
    await navigator.clipboard.writeText(json)
    $('#copy-status').textContent = 'Copiado!'
  } catch {
    $<HTMLTextAreaElement>('#json').value = json
    $('#json').hidden = false
    $('#copy-status').textContent = 'Não deu para copiar automaticamente; copie do campo abaixo.'
  }
})

$<HTMLTextAreaElement>('#relays').value = loadRelays().join('\n')
environment()
