<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import PhraseInput from '#lib/components/PhraseInput.svelte';
	import PinInput from '#lib/components/PinInput.svelte';
	import { friendlyError, session } from '#lib/session.svelte.ts';

	let phrase = $state('');
	let pin = $state('');
	let pinAgain = $state('');
	let busy = $state(false);
	let error = $state('');

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (pin !== pinAgain) return (error = 'Os dois PINs não são iguais.');
		busy = true;
		error = '';
		try {
			await session.resetPin(phrase, pin);
			await goto(resolve('/'));
		} catch (err) {
			error = friendlyError(err);
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Esqueci o PIN · Lero-lero</title></svelte:head>

<main>
	<h1>Esqueci o PIN</h1>
	<p class="hint">
		Com a sua frase de 12 palavras você cria um PIN novo. Suas conversas neste aparelho continuam aqui.
	</p>
	<form onsubmit={submit}>
		<PhraseInput id="frase" bind:value={phrase} />
		<PinInput id="pin" label="PIN novo (6 números)" bind:value={pin} />
		<PinInput id="pin2" label="Digite o PIN novo de novo" bind:value={pinAgain} />
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<div class="actions">
			<button class="primary" type="submit" disabled={busy}>{busy ? 'Trocando…' : 'Trocar o PIN'}</button>
			<a href={resolve('/desbloquear')}>Voltar</a>
		</div>
	</form>
	<p class="hint">Sem a frase não há como trocar o PIN: ela é a única chave reserva da sua conta.</p>
</main>
