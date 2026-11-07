<script lang="ts">
	// Mostra a frase para anotar. O jeito de guardar já foi escolhido antes, na lista de opções (item 26).
	import { onDestroy } from 'svelte';
	import PhraseGrid from './PhraseGrid.svelte';
	import Rich from './Rich.svelte';
	import { m } from '#lib/paraglide/messages.js';

	let { words }: { words: string[] } = $props();

	const CLEAR_AFTER_MS = 60_000;
	let copied = $state(false);
	let clearTimer: ReturnType<typeof setTimeout> | undefined;

	async function copy() {
		await navigator.clipboard.writeText(words.join(' '));
		copied = true;
		clearTimeout(clearTimer);
		// o navegador só deixa mexer na área de transferência com o app aberto e em foco;
		// se a pessoa saiu, não dá para limpar, e por isso o aviso é o que mais importa
		clearTimer = setTimeout(async () => {
			try {
				await navigator.clipboard.writeText('');
			} catch {
				// sem foco: fica como está
			}
			copied = false;
		}, CLEAR_AFTER_MS);
	}

	onDestroy(() => clearTimeout(clearTimer));
</script>

<div class="banner">
	<p><Rich text={m.frase_guarde_aviso()} /></p>
	<p>{m.frase_nunca_print()}</p>
</div>

<PhraseGrid {words} />

<div class="copy">
	<button type="button" onclick={copy}>{copied ? m.frase_copiada() : m.frase_copiar()}</button>
	<p class="hint">{m.frase_copiar_dica()}</p>
</div>

<style>
	.copy .hint {
		margin-top: 0.4rem;
	}
</style>
