<script lang="ts" module>
	type Group = [key: string, emojis: Array<[emoji: string, words: string]>];
	// a lista (~35 KB comprimida) só baixa na primeira vez que o seletor abre, e fica para as outras
	let loading: Promise<Group[]> | undefined;
	const load = () => (loading ??= import('#lib/emojis.json').then((data) => data.default as Group[]));
</script>

<script lang="ts">
	// Seletor de emojis (RF-29): o do campo de mensagem e o "+" das reações (RF-23). Lista gerada do emojibase em
	// português (scripts/emojis.js); busca pelo nome e pelas palavras, com os mais usados por mim primeiro.
	import { onMount } from 'svelte';
	import Icon from './Icon.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { countEmojiUse, mostUsed, readEmojiUsage } from '#lib/emoji-usage.ts';

	let {
		onpick,
		label,
		chosen
	}: {
		onpick: (emoji: string) => void;
		/** nome do botão de cada emoji para o leitor de tela */
		label: (emoji: string, name: string) => string;
		/** o já escolhido (a minha reação), marcado */
		chosen?: string;
	} = $props();

	const GROUP_NAMES: Record<string, () => string> = {
		smileys: m.emoji_grupo_carinhas,
		people: m.emoji_grupo_pessoas,
		animals: m.emoji_grupo_animais,
		food: m.emoji_grupo_comida,
		travel: m.emoji_grupo_viagem,
		activities: m.emoji_grupo_atividades,
		objects: m.emoji_grupo_objetos,
		symbols: m.emoji_grupo_simbolos,
		flags: m.emoji_grupo_bandeiras
	};
	// o primeiro emoji de cada grupo é o atalho para ele
	const SHORTCUTS: Record<string, string> = {
		smileys: '😀', people: '👋', animals: '🐶', food: '🍕', travel: '✈️',
		activities: '⚽', objects: '💡', symbols: '❤️', flags: '🏁'
	};

	let groups = $state.raw<Group[]>([]);
	let failed = $state(false);
	let query = $state('');
	const usage = readEmojiUsage();
	let list = $state<HTMLElement>();

	onMount(() => {
		load().then(
			(data) => (groups = data),
			() => (failed = true)
		);
	});

	const fold = (v: string) => v.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
	const names = $derived(new Map(groups.flatMap(([, emojis]) => emojis.map(([emoji, words]) => [emoji, words.split(';')[0]!]))));
	// palavras de cada emoji já sem acento, para a busca: "coracao" acha "coração"
	const searchable = $derived(groups.flatMap(([, emojis]) => emojis.map(([emoji, words]) => ({ emoji, words: fold(words).split(/[;\s]+/) }))));

	/** Cada palavra digitada é o começo de alguma palavra do emoji; os mais usados primeiro. */
	const found = $derived.by(() => {
		const terms = fold(query).split(/\s+/).filter(Boolean);
		if (!terms.length) return [];
		return searchable
			.filter(({ words }) => terms.every((term) => words.some((word) => word.startsWith(term))))
			.map(({ emoji }) => emoji)
			.sort((a, b) => (usage[b] ?? 0) - (usage[a] ?? 0));
	});
	const recent = mostUsed(usage, 16);

	function pick(emoji: string) {
		countEmojiUse(emoji);
		onpick(emoji);
	}

	function jump(key: string) {
		query = '';
		list?.querySelector(`[data-group="${key}"]`)?.scrollIntoView({ block: 'start' });
	}
</script>

{#snippet grid(emojis: string[])}
	<div class="grid">
		{#each emojis as emoji (emoji)}
			<button type="button" class="emoji" class:chosen={chosen === emoji} aria-pressed={chosen === emoji} aria-label={label(emoji, names.get(emoji) ?? emoji)} onclick={() => pick(emoji)}>
				{emoji}
			</button>
		{/each}
	</div>
{/snippet}

<div class="picker">
	<input type="search" bind:value={query} placeholder={m.emoji_buscar()} aria-label={m.emoji_buscar()} enterkeyhint="search" />
	{#if failed}
		<p class="error" role="alert">{m.emoji_erro()}</p>
	{:else if !groups.length}
		<p class="loading"><Icon name="loader" /></p>
	{:else}
		<nav class="shortcuts" aria-label={m.emoji_grupos()}>
			{#each groups as [key] (key)}
				<button type="button" aria-label={GROUP_NAMES[key]?.()} onclick={() => jump(key)}>{SHORTCUTS[key]}</button>
			{/each}
		</nav>
		<div class="list" bind:this={list}>
			{#if query.trim()}
				{#if found.length}
					{@render grid(found)}
				{:else}
					<p class="hint" role="status">{m.emoji_nenhum()}</p>
				{/if}
			{:else}
				{#if recent.length}
					<section>
						<h3>{m.emoji_grupo_usados()}</h3>
						{@render grid(recent)}
					</section>
				{/if}
				{#each groups as [key, emojis] (key)}
					<section data-group={key}>
						<h3>{GROUP_NAMES[key]?.()}</h3>
						{@render grid(emojis.map(([emoji]) => emoji))}
					</section>
				{/each}
			{/if}
		</div>
	{/if}
</div>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	input {
		width: 100%;
	}
	.shortcuts {
		display: flex;
		justify-content: space-between;
	}
	.shortcuts button {
		flex: 1;
		min-width: 0;
		/* alvos de toque de 48 px (RNF-63) */
		min-height: 3rem;
		padding: 0;
		border: none;
		background: none;
		font-size: 1.25rem;
	}
	.list {
		height: min(16rem, 40dvh);
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	/* centenas de botões: o navegador só desenha os grupos que estão na tela (aparelho de 2 GB, RNF-02) */
	section {
		content-visibility: auto;
		contain-intrinsic-size: auto 20rem;
	}
	h3 {
		margin: 0.5rem 0 0.2rem;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--muted);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(3rem, 1fr));
	}
	.emoji {
		min-height: 3rem;
		padding: 0;
		font-size: 1.6rem;
		line-height: 1;
		border-radius: 999px;
		border: 1px solid transparent;
		background: transparent;
	}
	.emoji.chosen {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 15%, var(--surface));
	}
	.loading {
		display: grid;
		place-items: center;
		height: min(16rem, 40dvh);
		color: var(--muted);
	}
</style>
