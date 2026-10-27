<script lang="ts">
	// Topo da conversa: voltar, foto e nome (com link para os detalhes, quando houver).
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';
	import { m } from '#lib/paraglide/messages.js';

	let { name, subtitle, href, avatar }: { name: string; subtitle?: string; href?: string; avatar: Snippet } = $props();
</script>

<header>
	<a class="back" href={resolve('/')} aria-label={m.conversa_voltar()}><Icon name="back" size={22} /></a>
	<svelte:element this={href ? 'a' : 'span'} class="who" {href}>
		{@render avatar()}
		<span class="text">
			<span class="name">{name}</span>
			{#if subtitle}<span class="subtitle">{subtitle}</span>{/if}
		</span>
	</svelte:element>
</header>

<style>
	header {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		padding: 0.5rem 1rem;
		border-bottom: 1px solid var(--line);
		background: var(--surface);
	}
	header a {
		text-decoration: none;
	}
	.back {
		display: grid;
		place-items: center;
		color: var(--fg);
	}
	.who {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-width: 0;
	}
	.text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.name,
	.subtitle {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--fg);
	}
	.name {
		font-weight: 700;
		font-size: 1.05rem;
	}
	.subtitle {
		font-size: 0.8rem;
		color: var(--muted);
	}
</style>
