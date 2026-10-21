import '../style.css'
import './rolagem.css'
import { mount, unmount, type Component } from 'svelte'
import ChatPlain from './ChatPlain.svelte'
import ChatVirtual from './ChatVirtual.svelte'
import ChatWindow from './ChatWindow.svelte'
import { generateMessages } from './messages'
import { afterPaint, scrollUp, type ScrollResult } from './measure'
import { ms } from '../stats'

type Mode = 'simples' | 'cv por mensagem' | 'cv em blocos' | 'janela' | 'virtualizada'
type ChatExports = { element(): HTMLElement; scrollToBottom(): Promise<void> }
type Run = { modo: Mode; mensagens: number; abrirMs: number; nosNoDom: number; heapMB?: number; rolagem: ScrollResult }

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

async function measure(mode: Mode, n: number): Promise<Run> {
  const stage = $('#stage')
  const messages = generateMessages(n)
  const [Chat, props] = component(mode)

  // abrir a conversa: do mount até a primeira pintura já posicionada no fim (RNF-11)
  const t0 = performance.now()
  const chat = mount(Chat, { target: stage, props: { messages, ...props } }) as ChatExports
  await chat.scrollToBottom()
  await afterPaint()
  const abrirMs = performance.now() - t0

  const run: Run = {
    modo: mode,
    mensagens: n,
    abrirMs,
    nosNoDom: stage.getElementsByTagName('*').length,
    heapMB: heapMB(),
    rolagem: await scrollUp(chat.element(), SPEED, DISTANCE),
  }
  unmount(chat)
  await afterPaint()
  return run
}

function render() {
  const fmt = (r: Run) => `<tr>
    <td>${r.modo}</td><td>${r.mensagens}</td>
    <td class="${r.abrirMs < 500 ? 'good' : 'bad'}">${ms(r.abrirMs)}</td>
    <td class="${r.rolagem.fps >= 55 ? 'good' : 'bad'}">${r.rolagem.fps.toFixed(0)}</td>
    <td>${r.rolagem.droppedPct.toFixed(1)}%</td>
    <td class="${r.rolagem.janks === 0 ? 'good' : 'bad'}">${r.rolagem.janks}</td>
    <td>${ms(r.rolagem.frameTime.p95)}</td>
    <td>${r.nosNoDom}</td><td>${r.heapMB ?? '—'}</td></tr>`
  $('#results').innerHTML = `<table class="grid">
    <tr><th>Modo</th><th>Msgs</th><th>Abrir</th><th>FPS</th><th>Quadros perdidos</th><th>Engasgos</th><th>p95 quadro</th><th>Nós DOM</th><th>Heap MB</th></tr>
    ${runs.map(fmt).join('')}</table>
    <p class="hint">Metas: abrir &lt; 500 ms (RNF-11); rolagem a 60 fps sem engasgos (RNF-14). Engasgo = quadro acima de 50 ms; quadro perdido = acima de 25 ms.</p>`
}

$<HTMLButtonElement>('#run-btn').addEventListener('click', async (e) => {
  const btn = e.currentTarget as HTMLButtonElement
  btn.disabled = true
  const n = Number($<HTMLSelectElement>('#count').value)
  try {
    for (const mode of MODES) {
      $('#status').textContent = `Medindo ${mode} com ${n} mensagens…`
      runs.push(await measure(mode, n))
      render()
    }
    $('#status').textContent = 'Pronto.'
  } catch (err) {
    $('#status').textContent = `Erro: ${err}`
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
