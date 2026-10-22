<script lang="ts">
	let { words }: { words: string[] } = $props();
</script>

<ol class="grid" aria-label="Frase de recuperação">
	{#each words as word, i (i)}
		<li><span class="n">{i + 1}</span>{word}</li>
	{/each}
</ol>

<style>
	.grid {
		list-style: none;
		padding: 0;
		margin: 1rem 0;
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.5rem;
	}
	@media (min-width: 420px) {
		.grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}
	li {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 8px;
		padding: 0.5rem 0.6rem;
		font-family: ui-monospace, monospace;
		font-size: 1.02rem;
	}
	.n {
		display: inline-block;
		min-width: 1.6rem;
		color: var(--muted);
		font-size: 0.85rem;
	}
</style>
