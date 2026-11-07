<script lang="ts">
	// Cabeçalho dos fluxos em passos (cadastro, recuperar a conta, esqueci o PIN; item 26): seta de voltar,
	// "Passo 1 de 2" e a barra de progresso
	import Icon from '#lib/components/Icon.svelte';
	import { m } from '#lib/paraglide/messages.js';

	let {
		current,
		total,
		href,
		onback,
		disabled = false
	}: {
		current: number;
		total: number;
		/** voltar sai do fluxo (link); sem ele, `onback` volta um passo */
		href?: string;
		onback?: () => void;
		disabled?: boolean;
	} = $props();
</script>

<div class="progress">
	{#if href}
		<a class="back" {href} aria-label={m.comum_voltar()}><Icon name="back" size={22} /></a>
	{:else}
		<button class="back" type="button" onclick={onback} {disabled} aria-label={m.comum_voltar()}><Icon name="back" size={22} /></button>
	{/if}
	<span class="label">{m.cadastro_passo({ atual: current, total })}</span>
	<span class="bar" aria-hidden="true"><i style:width={`${(100 * current) / total}%`}></i></span>
</div>

<style>
	.progress {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		column-gap: 0.5rem;
		font-size: 0.85rem;
		color: var(--muted);
	}
	/* alvo de toque de 48 px (RNF-63) */
	.back {
		grid-row: span 2;
		display: grid;
		place-items: center;
		width: 3rem;
		height: 3rem;
		margin-left: -0.75rem;
		padding: 0;
		border: 0;
		background: none;
		color: var(--fg);
	}
	.bar {
		height: 6px;
		border-radius: 999px;
		background: var(--line);
		overflow: hidden;
	}
	.bar i {
		display: block;
		height: 100%;
		border-radius: 999px;
		background: var(--accent);
		transition: width 0.3s;
	}
</style>
