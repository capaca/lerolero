<script lang="ts">
  import { tick } from 'svelte'
  import Bubble from './Bubble.svelte'
  import type { Message } from './messages'

  // Janela de mensagens: só uma fatia contínua da conversa fica no DOM. Perto do topo,
  // carrega um lote mais antigo e descarta o que ficou longe embaixo (e vice-versa),
  // corrigindo scrollTop para o conteúdo na tela não pular.
  let {
    messages,
    initial = 200,
    batch = 100,
    max = 400,
    margin = 1500,
  }: { messages: Message[]; initial?: number; batch?: number; max?: number; margin?: number } = $props()

  let scroller: HTMLDivElement
  let start = $state(0)
  let end = $state(0)
  let busy = false
  const visible = $derived(messages.slice(start, end))

  // aplica a nova janela e compensa a altura que entrou ou saiu acima do que está na tela
  async function shift(newStart: number, newEnd: number) {
    busy = true
    const firstKept = Math.max(start, newStart)
    const anchor = scroller.querySelector<HTMLElement>(`[data-index="${firstKept}"]`)
    const before = anchor?.offsetTop ?? 0
    start = newStart
    end = newEnd
    await tick()
    if (!scroller) return // desmontado durante a troca
    const after = scroller.querySelector<HTMLElement>(`[data-index="${firstKept}"]`)?.offsetTop ?? before
    scroller.scrollTop += after - before
    busy = false
  }

  function onscroll() {
    if (busy || !scroller) return
    const { scrollTop, scrollHeight, clientHeight } = scroller
    if (scrollTop < margin && start > 0) {
      const newStart = Math.max(0, start - batch)
      shift(newStart, Math.min(end, newStart + max))
    } else if (scrollHeight - scrollTop - clientHeight < margin && end < messages.length) {
      const newEnd = Math.min(messages.length, end + batch)
      shift(Math.max(start, newEnd - max), newEnd)
    }
  }

  export function element() {
    return scroller
  }

  export async function scrollToBottom() {
    end = messages.length
    start = Math.max(0, end - initial)
    await tick()
    scroller.scrollTop = scroller.scrollHeight
  }
</script>

<div class="scroller" bind:this={scroller} {onscroll}>
  {#each visible as message, k (message.id)}
    <div class="row" data-index={start + k}><Bubble {message} /></div>
  {/each}
</div>
