import '../style.css'
import './rolagem.css'
import { mount, unmount, type Component } from 'svelte'
import ChatPlain from './ChatPlain.svelte'
import ChatVirtual from './ChatVirtual.svelte'
import ChatWindow from './ChatWindow.svelte'
import { generateMessages } from './messages'
import { afterPaint, scrollUp, type ScrollResult } from './measure'
import { ms } from '../stats'
import { ensureIsolated, pageMemoryMB } from '../memory'

type Mode = 'simples' | 'cv por mensagem' | 'cv em blocos' | 'janela' | 'virtualizada'
type ChatExports = { element(): HTMLElement; scrollToBottom(): Promise<void> }
type Run = { modo: Mode; repeticao: number; mensagens: number; abrirMs: number; nosNoDom: number; heapMB?: number; memoriaBaseMB?: number; memoriaMB?: number; rolagem: ScrollResult }

const MODES: Mode[] = ['simples', 'cv por mensagem', 'cv em blocos', 'janela', 'virtualizada']
const SPEED = 2500 // px/s, um arrasto rápido
const DISTANCE = 30_000 // px

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!
const report: Record<string, unknown> = { versao: 1, data: new Date().toISOString(), userAgent: navigator.userAgent }
const runs: Run[] = []

function heapMB(): number | undefined {
  const mem = (performance as any).memory
  return mem ? Math.round(mem.usedJSHeapSize / 1048576) : undefined
}

function component(mode: Mode): [Component<any, any>, Record<string, unknown>] {
  if (mode === 'virtualizada') return [ChatVirtual, {}]
  if (mode === 'janela') return [ChatWindow, {}]
  if (mode === 'cv por mensagem') return [ChatPlain, { contentVisibility: 'message' }]
  if (mode === 'cv em blocos') return [ChatPlain, { contentVisibility: 'block' }]
  return [ChatPlain, {}]
}

async function measure(mode: Mode, n: number, repetition: number, withMemory: boolean): Promise<Run> {
  const stage = $('#stage')
  const messages = generateMessages(n)
  const [Chat, props] = component(mode)

  // Medir a memória força uma coleta de lixo: limpa o que sobrou do modo anterior
  // antes de começar, para não cair no meio desta rolagem, e dá a linha de base.
  $('#status').textContent = `Preparando ${mode} (limpando a memória do modo anterior)…`
  const memoriaBaseMB = await pageMemoryMB()
  await afterPaint()
  $('#status').textContent = `Medindo ${mode} com ${n} mensagens (repetição ${repetition})…`

  // abrir a conversa: do mount até a primeira pintura já posicionada no fim (RNF-11)
  const t0 = performance.now()
  const chat = mount(Chat, { target: stage, props: { messages, ...props } }) as ChatExports
  await chat.scrollToBottom()
  await afterPaint()
  const abrirMs = performance.now() - t0

  const run: Run = {
    modo: mode,
    repeticao: repetition,
    mensagens: n,
    abrirMs,
    nosNoDom: stage.getElementsByTagName('*').length,
    heapMB: heapMB(),
    memoriaBaseMB,
    rolagem: await scrollUp(chat.element(), SPEED, DISTANCE),
  }
  // com a conversa ainda montada; o navegador mede no próximo GC (até ~20 s).
  // A memória não varia entre repetições: mede só na primeira, para poupar tempo.
  if (withMemory) {
    $('#status').textContent = `Medindo a memória de ${mode}…`
    run.memoriaMB = await pageMemoryMB()
  }
  unmount(chat)
  await afterPaint()
  return run
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}

// uma linha por modo e quantidade de mensagens, com a mediana das repetições
function render() {
  const groups = new Map<string, Run[]>()
  for (const r of runs) {
    const key = `${r.modo}|${r.mensagens}`
    groups.set(key, [...(groups.get(key) ?? []), r])
  }
  const rows = [...groups.values()].map((g) => {
    const first = g[0]
    const open = median(g.map((r) => r.abrirMs))
    const smooth = median(g.map((r) => r.rolagem.smoothnessPct))
    const janks = g.map((r) => r.rolagem.janks)
    const worst = Math.max(...g.map((r) => r.rolagem.frameTime.max))
    const hz = [...new Set(g.map((r) => r.rolagem.refreshHz))].join('/')
    const mem = g.find((r) => r.memoriaMB !== undefined)
    return `<tr>
      <td>${first.modo}</td><td>${first.mensagens}</td><td>${g.length}</td>
      <td class="${open < 500 ? 'good' : 'bad'}">${ms(open)}</td>
      <td class="${smooth >= 95 ? 'good' : 'bad'}">${smooth.toFixed(1)}%</td>
      <td class="${janks.every((j) => j === 0) ? 'good' : 'bad'}">${janks.join(' / ')}</td>
      <td>${ms(worst)}</td><td>${hz}</td><td>${first.nosNoDom}</td>
      <td>${mem?.memoriaMB === undefined || mem.memoriaBaseMB === undefined ? '—' : mem.memoriaMB - mem.memoriaBaseMB}</td>
      <td>${mem?.memoriaMB ?? '—'}</td></tr>`
  })
  $('#results').innerHTML = `<table class="grid">
    <tr><th>Modo</th><th>Msgs</th><th>Rep.</th><th>Abrir</th><th>Fluidez</th><th>Engasgos</th><th>Pior quadro</th><th>Tela Hz</th><th>Nós DOM</th><th>Memória da conversa MB</th><th>Memória total MB</th></tr>
    ${rows.join('')}</table>
    <p class="hint">Abrir e fluidez: mediana das repetições. Metas: abrir &lt; 500 ms (RNF-11); rolagem sem engasgos (RNF-14).
    Fluidez = quadros entregues ÷ quadros que a tela pediu, na frequência que a tela estava usando (telas com taxa variável mudam sozinhas entre 45 e 120 Hz).
    Engasgos = quadros acima de 50 ms, em cada repetição. Memória = JavaScript + DOM com a conversa aberta.</p>`
}

$<HTMLButtonElement>('#run-btn').addEventListener('click', async (e) => {
  const btn = e.currentTarget as HTMLButtonElement
  btn.disabled = true
  const n = Number($<HTMLSelectElement>('#count').value)
  const choice = $<HTMLSelectElement>('#mode').value
  const modes = choice === 'todos' ? MODES : MODES.filter((m) => m === choice)
  const repetitions = Number($<HTMLSelectElement>('#reps').value)
  try {
    // alterna os modos a cada volta: se o aparelho esquentar, não prejudica sempre o mesmo
    for (let rep = 1; rep <= repetitions; rep++) {
      for (const mode of modes) {
        runs.push(await measure(mode, n, rep, rep === 1))
        render()
      }
    }
    $('#status').textContent = 'Pronto.'
  } catch (err) {
    $('#status').textContent = `Erro: ${err}`
    ;((report.erros ??= []) as string[]).push(String(err))
  } finally {
    btn.disabled = false
  }
})

$<HTMLButtonElement>('#copy-btn').addEventListener('click', async () => {
  report.velocidadePxS = SPEED
  report.distanciaPx = DISTANCE
  report.medicoes = runs
  const json = JSON.stringify(report, null, 2)
  try {
    await navigator.clipboard.writeText(json)
    $('#status').textContent = 'Copiado!'
  } catch {
    $<HTMLTextAreaElement>('#json').value = json
    $('#json').hidden = false
    $('#status').textContent = 'Não deu para copiar automaticamente; copie do campo abaixo.'
  }
})

$('#mode').innerHTML = ['todos', ...MODES]
  .map((m) => `<option value="${m}">${m === 'todos' ? 'Todos' : m}</option>`)
  .join('')

ensureIsolated().then((isolated) => {
  report.isolado = isolated
  $('#isolation').textContent = isolated
    ? 'Medição de memória (JS + DOM) disponível.'
    : 'Este navegador não mede a memória da página (JS + DOM); a coluna Memória fica vazia. No Android, use o Chrome.'
})
