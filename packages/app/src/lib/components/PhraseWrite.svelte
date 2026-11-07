<script lang="ts">
	// Anotar as palavras à mão: a frase e, ao tocar no botão, o teste de duas palavras (RF-03). Usado em "Guarde sua
	// frase" e na Proteção da conta, com as palavras já reveladas pelo PIN: não pede o PIN de novo (item 26).
	import PhraseBackup from './PhraseBackup.svelte';
	import PhraseCheck from './PhraseCheck.svelte';
	import { m } from '#lib/paraglide/messages.js';

	let {
		words,
		onconfirmed,
		checking = $bindable(false)
	}: { words: string[]; onconfirmed: () => void; checking?: boolean } = $props();
</script>

{#if checking}
	<PhraseCheck {words} {onconfirmed} />
{:else}
	<PhraseBackup {words} />
	<div class="actions"><button class="primary" onclick={() => (checking = true)}>{m.frase_ja_guardei()}</button></div>
{/if}
