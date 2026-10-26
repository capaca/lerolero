<script lang="ts">
	import BackLink from '#lib/components/BackLink.svelte';
	import { resolve } from '$app/paths';
	import PhraseCheck from '#lib/components/PhraseCheck.svelte';
	import PhraseBackup from '#lib/components/PhraseBackup.svelte';
	import PhraseReveal from '#lib/components/PhraseReveal.svelte';
	import { session } from '#lib/session.svelte.ts';

	let words = $state<string[]>([]);
	let checking = $state(false);
	let done = $state(false);

	async function confirmed() {
		await session.confirmPhrase();
		checking = false;
		done = true;
	}
</script>

<svelte:head><title>Frase de recuperação · Lero-lero</title></svelte:head>

<main>
	<BackLink href={resolve('/ajustes')} label="Ajustes" />
	<h1>Frase de recuperação</h1>

	{#if words.length === 0}
		<PhraseReveal onrevealed={(w) => (words = w)} />
	{:else if checking}
		<PhraseCheck {words} onconfirmed={confirmed} />
	{:else}
		<PhraseBackup {words} />
		{#if done}
			<p role="status"><strong>Frase conferida.</strong> Mantenha-a guardada num lugar seguro.</p>
		{:else if !session.identity?.phraseConfirmed}
			<div class="actions"><button class="primary" onclick={() => (checking = true)}>Já guardei, conferir</button></div>
		{/if}
	{/if}
</main>
