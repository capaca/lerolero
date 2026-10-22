<script lang="ts">
	// Folha que sobe do pé da tela, com fundo escurecido; fecha no fundo ou com Esc.
	// Os itens usam a classe "item" (e "item cancel" para o Cancelar).
	import type { Snippet } from 'svelte';

	let { label, onclose, children }: { label: string; onclose: () => void; children: Snippet } = $props();
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" onclick={onclose}></div>
<div class="sheet" role="dialog" aria-modal="true" aria-label={label}>
	{@render children()}
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgb(0 0 0 / 0.35);
		z-index: 20;
	}
	.sheet {
		position: fixed;
		left: 50%;
		bottom: 0;
		transform: translateX(-50%);
		width: min(100%, 520px);
		z-index: 21;
		background: var(--surface);
		border-radius: 16px 16px 0 0;
		padding: 0.6rem 1rem calc(1rem + env(safe-area-inset-bottom));
		box-shadow: 0 -4px 24px rgb(0 0 0 / 0.2);
	}
	.sheet :global(.item) {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		width: 100%;
		border: none;
		background: none;
		border-radius: 10px;
		padding: 0.9rem 0.6rem;
		text-align: left;
		font-weight: 500;
		color: var(--fg);
		text-decoration: none;
	}
	.sheet :global(.item:hover) {
		background: var(--bg);
	}
	.sheet :global(.cancel) {
		justify-content: center;
		color: var(--muted);
	}
	.sheet :global(p) {
		margin: 0.4rem 0;
	}
</style>
