<script lang="ts">
	// Teste de verificação (RF-03): pede duas palavras sorteadas da frase.
	import { matchWord, pickCheckPositions } from '@lerolero/core';

	let { words, onconfirmed }: { words: string[]; onconfirmed: () => void } = $props();

	const positions = pickCheckPositions(2);
	let answers = $state(['', '']);
	let error = $state('');

	function check(event: SubmitEvent) {
		event.preventDefault();
		const ok = positions.every((p, i) => matchWord(answers[i]) === words[p]);
		if (ok) onconfirmed();
		else error = 'Alguma palavra não confere. Olhe o papel onde você anotou e tente de novo.';
	}
</script>

<form onsubmit={check}>
	<p>Para ter certeza de que você anotou certo, digite estas palavras da sua frase:</p>
	{#each positions as p, i (p)}
		<label for={`palavra-${p}`}>{p + 1}ª palavra</label>
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
	<div class="actions"><button class="primary" type="submit">Confirmar</button></div>
</form>
