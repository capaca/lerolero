<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import PinInput from '#lib/components/PinInput.svelte';
	import { friendlyError, session } from '#lib/session.svelte.ts';

	let pin = $state('');
	let busy = $state(false);
	let error = $state('');

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = '';
		try {
			await session.unlock(pin);
			await goto(resolve('/'));
		} catch (err) {
			error = friendlyError(err);
			pin = '';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Lero-lero</title></svelte:head>

<main>
	<h1>Olá{session.identity ? `, ${session.identity.displayName}` : ''}</h1>
	<form onsubmit={submit}>
		<PinInput id="pin" label="Digite seu PIN" bind:value={pin} autofocus />
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<div class="actions">
			<button class="primary" type="submit" disabled={busy || pin.length !== 6}>
				{busy ? 'Abrindo…' : 'Entrar'}
			</button>
		</div>
	</form>
	<p><a href={resolve('/esqueci-pin')}>Esqueci o PIN</a></p>
</main>
