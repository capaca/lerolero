<script lang="ts">
	// Mostra a frase e orienta onde guardar: papel ou gerenciador de senhas.
	// Usado no cadastro e em "ver minha frase".
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
	<p>{m.frase_escolha_jeito()}</p>
	<ul>
		<li><Rich text={m.frase_jeito_papel()} /></li>
		<li><Rich text={m.frase_jeito_gerenciador()} /></li>
	</ul>
	<p>{m.frase_nunca_print()}</p>
</div>

<PhraseGrid {words} />

<div class="copy">
	<button type="button" onclick={copy}>{copied ? m.frase_copiada() : m.frase_copiar()}</button>
	<p class="hint">{m.frase_copiar_dica()}</p>
</div>

<style>
	ul {
		margin: 0 0 0.5rem;
		padding-left: 1.2rem;
	}
	li {
		margin-bottom: 0.3rem;
	}
	.copy .hint {
		margin-top: 0.4rem;
	}
</style>
