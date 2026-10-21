<script lang="ts">
  import { tick } from 'svelte'
  import Bubble from './Bubble.svelte'
  import type { Message } from './messages'

  // Lista virtualizada com alturas variáveis: só as mensagens perto da tela existem no DOM.
  // As alturas começam estimadas e são corrigidas quando cada mensagem é medida.
  let { messages, estimate = 64, overscan = 800 }: { messages: Message[]; estimate?: number; overscan?: number } = $props()

  let scroller: HTMLDivElement
  let items: HTMLDivElement
  let scrollTop = $state(0)
  let viewport = $state(0)
  let version = $state(0)

  const heights = $derived(new Float64Array(messages.length).fill(estimate))
  // offsets[i] = topo da mensagem i; offsets[n] = altura total
  const offsets = $derived.by(() => {
    version
    const o = new Float64Array(heights.length + 1)
    for (let i = 0; i < heights.length; i++) o[i + 1] = o[i] + heights[i]
    return o
  })

  function indexAt(y: number) {
    let lo = 0
    let hi = heights.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (offsets[mid] <= y) lo = mid
      else hi = mid - 1
    }
    return Math.max(0, lo)
  }

  const start = $derived(indexAt(scrollTop - overscan))
  const end = $derived(Math.min(messages.length, indexAt(scrollTop + viewport + overscan) + 1))
  const visible = $derived(messages.slice(start, end))

  // Mede as mensagens renderizadas. Se uma mensagem acima da primeira visível
  // mudar de altura, compensa o scrollTop para o conteúdo na tela não pular.
  $effect(() => {
    visible
    if (!scroller || !items) return // desmontando
    const anchor = indexAt(scroller.scrollTop)
    let shift = 0
    let changed = false
    for (const node of items.children as HTMLCollectionOf<HTMLElement>) {
      const i = Number(node.dataset.index)
      const h = node.offsetHeight
      if (h !== heights[i]) {
        if (i < anchor) shift += h - heights[i]
        heights[i] = h
        changed = true
      }
    }
    if (changed) {
      version++
      if (shift) scroller.scrollTop += shift
    }
  })

  export function element() {
    return scroller
  }

  export async function scrollToBottom() {
    // as alturas reais só aparecem depois de renderizar: repete até estabilizar
    await tick()
    for (let i = 0; i < 10; i++) {
      scroller.scrollTop = scroller.scrollHeight
      scrollTop = scroller.scrollTop
      await tick()
      if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1) break
    }
  }
</script>

<div
  class="scroller virtual"
  bind:this={scroller}
  bind:clientHeight={viewport}
  onscroll={(e) => (scrollTop = e.currentTarget.scrollTop)}
>
  <div style:height="{offsets[messages.length]}px" style:position="relative">
    <div bind:this={items} style:transform="translateY({offsets[start]}px)">
      {#each visible as message, k (message.id)}
        <div class="row" data-index={start + k}><Bubble {message} /></div>
      {/each}
    </div>
  </div>
</div>
