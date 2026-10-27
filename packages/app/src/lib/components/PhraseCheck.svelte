<script lang="ts">
	// Teste de verificação (RF-03): pede duas palavras sorteadas da frase.
	import { matchWord, pickCheckPositions } from '@lerolero/core';
	import { m } from '#lib/paraglide/messages.js';

	let { words, onconfirmed }: { words: string[]; onconfirmed: () => void } = $props();

	const positions = pickCheckPositions(2);
	let answers = $state(['', '']);
	let error = $state('');

	function check(event: SubmitEvent) {
		event.preventDefault();
		const ok = positions.every((p, i) => matchWord(answers[i]) === words[p]);
		if (ok) onconfirmed();
		else error = m.frase_teste_erro();
	}
</script>

<form onsubmit={check}>
	<p>{m.frase_teste_pedido()}</p>
	{#each positions as p, i (p)}
		<label for={`palavra-${p}`}>{m.frase_teste_palavra({ position: p + 1 })}</label>
		<input
			id={`palavra-${p}`}
			autocomplete="off"
			autocapitalize="none"
			spellcheck="false"
			bind:value={answers[i]}
			oninput={() => (error = '')}
		/>
	{/each}
	{#if error}<p class="error" role="alert">{error}</p>{/if}
	<div class="actions"><button class="primary" type="submit">{m.frase_confirmar()}</button></div>
</form>
