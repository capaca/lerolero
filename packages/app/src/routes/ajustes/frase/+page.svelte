<script lang="ts">
	import TopBar from '#lib/components/TopBar.svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import PhraseCheck from '#lib/components/PhraseCheck.svelte';
	import PhraseBackup from '#lib/components/PhraseBackup.svelte';
	import PhraseReveal from '#lib/components/PhraseReveal.svelte';
	import Rich from '#lib/components/Rich.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { session } from '#lib/session.svelte.ts';

	// aberta pela opção "Anotar" da Proteção da conta: a seta volta para lá, não para os Ajustes
	const fromProtection = page.url.searchParams.get('de') === 'protecao';

	let words = $state<string[]>([]);
	let checking = $state(false);
	let done = $state(false);

	async function confirmed() {
		await session.confirmPhrase();
		checking = false;
		done = true;
	}
</script>

<svelte:head><title>{m.titulo_pagina({ pagina: m.frase_titulo() })}</title></svelte:head>

<TopBar
	title={m.frase_titulo()}
	back={fromProtection ? resolve('/ajustes/protecao') : resolve('/ajustes')}
	backTo={fromProtection ? m.protecao_titulo() : m.inicio_ajustes()}
/>

<main>

	{#if words.length === 0}
		<PhraseReveal onrevealed={(w) => (words = w)} />
	{:else if checking}
		<PhraseCheck {words} onconfirmed={confirmed} />
	{:else}
		<PhraseBackup {words} />
		{#if done}
			<p role="status"><Rich text={m.frase_conferida()} /></p>
		{:else if !session.identity?.phraseConfirmed}
			<div class="actions"><button class="primary" onclick={() => (checking = true)}>{m.frase_ja_guardei()}</button></div>
		{/if}
	{/if}
</main>
