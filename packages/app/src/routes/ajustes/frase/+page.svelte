<script lang="ts">
	import { resolve } from '$app/paths';
	import PhraseCheck from '#lib/components/PhraseCheck.svelte';
	import PhraseBackup from '#lib/components/PhraseBackup.svelte';
	import PinInput from '#lib/components/PinInput.svelte';
	import { friendlyError, session } from '#lib/session.svelte.ts';

	// pede o PIN de novo mesmo com o app aberto: a frase é a coisa mais sensível da conta
	let pin = $state('');
	let words = $state<string[]>([]);
	let checking = $state(false);
	let done = $state(false);
	let error = $state('');

	async function reveal(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		try {
			words = await session.reveal(pin);
		} catch (err) {
			error = friendlyError(err);
		} finally {
			pin = '';
		}
	}

	async function confirmed() {
		await session.confirmPhrase();
		checking = false;
		done = true;
	}
</script>

<svelte:head><title>Frase de recuperação · Lero-lero</title></svelte:head>

<main>
	<p><a href={resolve('/ajustes')}>← Ajustes</a></p>
	<h1>Frase de recuperação</h1>

	{#if words.length === 0}
		<form onsubmit={reveal}>
			<PinInput id="pin" label="Digite seu PIN para ver a frase" bind:value={pin} autofocus />
			{#if error}<p class="error" role="alert">{error}</p>{/if}
			<div class="actions"><button class="primary" type="submit" disabled={pin.length !== 6}>Ver frase</button></div>
		</form>
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
