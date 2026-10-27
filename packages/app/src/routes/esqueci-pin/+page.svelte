<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import PhraseInput from '#lib/components/PhraseInput.svelte';
	import PinInput from '#lib/components/PinInput.svelte';
	import { friendlyError } from '#lib/errors.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { session } from '#lib/session.svelte.ts';

	let phrase = $state('');
	let pin = $state('');
	let pinAgain = $state('');
	let busy = $state(false);
	let error = $state('');

	// PIN em dois campos: completar o 1º pula para o 2º; se não bater, treme e apaga o 2º
	let pinAgainInput = $state<PinInput>();
	let pinShakes = $state(0);
	function pinMismatch() {
		error = m.comum_pins_diferentes();
		pinAgain = '';
		pinShakes++;
		navigator.vibrate?.(150);
		void pinAgainInput?.focus();
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (pin !== pinAgain) return pinMismatch();
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

<svelte:head><title>{m.titulo_pagina({ pagina: m.esqueci_titulo() })}</title></svelte:head>

<main>
	<h1>{m.esqueci_titulo()}</h1>
	<p class="hint">{m.esqueci_dica()}</p>
	<form onsubmit={submit}>
		<PhraseInput id="frase" bind:value={phrase} />
		<PinInput id="pin" label={m.esqueci_pin_rotulo()} bind:value={pin} oncomplete={() => pinAgainInput?.focus()} />
		<PinInput
			bind:this={pinAgainInput}
			id="pin2"
			label={m.esqueci_pin_repetir()}
			bind:value={pinAgain}
			error={!!error && !pinAgain}
			shakes={pinShakes}
			oncomplete={() => pin !== pinAgain && pinMismatch()}
		/>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<div class="actions">
			<button class="primary" type="submit" disabled={busy}>{busy ? m.esqueci_trocando() : m.esqueci_trocar()}</button>
			<a href={resolve('/desbloquear')}>{m.comum_voltar()}</a>
		</div>
	</form>
	<p class="hint">{m.esqueci_sem_frase()}</p>
</main>
