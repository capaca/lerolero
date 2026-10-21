<script lang="ts">
  import { tick } from 'svelte'
  import Bubble from './Bubble.svelte'
  import type { Message } from './messages'

  // Todas as mensagens no DOM. Com contentVisibility, o navegador pula layout e
  // pintura do que está fora da tela: por mensagem ou por bloco de `blockSize` mensagens.
  let {
    messages,
    contentVisibility = 'none',
    blockSize = 50,
  }: { messages: Message[]; contentVisibility?: 'none' | 'message' | 'block'; blockSize?: number } = $props()

  const blocks = $derived.by(() => {
    if (contentVisibility !== 'block') return [messages]
    const out: Message[][] = []
    for (let i = 0; i < messages.length; i += blockSize) out.push(messages.slice(i, i + blockSize))
    return out
  })

  let scroller: HTMLDivElement

  export function element() {
    return scroller
  }

  export async function scrollToBottom() {
    await tick()
    scroller.scrollTop = scroller.scrollHeight
  }
</script>

<div class="scroller" class:cv={contentVisibility === 'message'} bind:this={scroller}>
  {#each blocks as block, b (b)}
    <div class:cv-block={contentVisibility === 'block'} style:--block-estimate="{block.length * 64}px">
      {#each block as message (message.id)}
        <div class="row"><Bubble {message} /></div>
      {/each}
    </div>
  {/each}
</div>
