<script lang="ts">
	// Campo para digitar a frase de 12 palavras, com sugestões para a palavra em digitação.
	import { matchWord, PHRASE_LENGTH, suggestWords } from '@lerolero/core';

	let { value = $bindable(''), id }: { value?: string; id: string } = $props();

	const tokens = $derived(value.split(/\s+/).filter(Boolean));
	const typing = $derived(/\s$/.test(value) ? '' : (tokens.at(-1) ?? ''));
	const suggestions = $derived(typing && !matchWord(typing) ? suggestWords(typing) : []);
	const unknown = $derived(
		tokens
			.map((t, i) => ({ t, i }))
			.filter(({ t, i }) => !(i === tokens.length - 1 && t === typing) && !matchWord(t))
	);

	function complete(word: string) {
		value = [...tokens.slice(0, -1), word].join(' ') + ' ';
		document.getElementById(id)?.focus();
	}
</script>

<label for={id}>Sua frase de recuperação</label>
<textarea
	{id}
	rows="4"
	autocomplete="off"
	autocapitalize="none"
	spellcheck="false"
	placeholder="As 12 palavras, separadas por espaço"
	bind:value
></textarea>
<p class="hint">
	{tokens.length} de {PHRASE_LENGTH} palavras
	{#if unknown.length}
		· <span class="error">não reconheço: {unknown.map(({ t, i }) => `${i + 1}ª "${t}"`).join(', ')}</span>
	{/if}
</p>
{#if suggestions.length}
	<div class="suggestions" aria-label="Sugestões">
		{#each suggestions as word (word)}
			<button type="button" onclick={() => complete(word)}>{word}</button>
		{/each}
	</div>
{/if}

<style>
	textarea {
		font-family: ui-monospace, monospace;
	}
	.suggestions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.suggestions button {
		padding: 0.4rem 0.7rem;
		font-weight: 500;
	}
</style>
