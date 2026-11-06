<script lang="ts">
	// Barra do topo em pedra, igual em todas as telas (item 26): voltar, título e ações.
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';
	import { m } from '#lib/paraglide/messages.js';

	let { title, back, backTo, actions }: { title?: string; back?: string; backTo?: string; actions?: Snippet } = $props();
</script>

<header class="on-bar">
	<div class="inner">
		{#if back}<a class="back" href={back} aria-label={m.comum_voltar_para({ destino: backTo ?? '' })}><Icon name="back" size={22} /></a>{/if}
		{#if title}<h1>{title}</h1>{/if}
		{#if actions}<nav>{@render actions()}</nav>{/if}
	</div>
</header>

<style>
	header {
		background: var(--bar);
	}
	.inner {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		max-width: 560px;
		min-height: 3.5rem;
		margin: 0 auto;
		padding: 0.25rem 0.5rem 0.25rem 16px;
	}
	/* alvo de toque de 48 px (RNF-63) */
	.back {
		display: grid;
		place-items: center;
		flex: none;
		width: 3rem;
		height: 3rem;
		margin-left: -0.75rem;
		color: var(--fg);
	}
	h1 {
		flex: 1;
		min-width: 0;
		margin: 0;
		font-size: 1.25rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	nav {
		display: flex;
		gap: 0.2rem;
		margin-left: auto;
	}
</style>
