<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import PhraseInput from '#lib/components/PhraseInput.svelte';
	import PinInput from '#lib/components/PinInput.svelte';
	import { friendlyError } from '#lib/errors.ts';
	import { session } from '#lib/session.svelte.ts';

	let phrase = $state('');
	let name = $state('');
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
			await session.restore(phrase, pin, name.trim());
			await goto(resolve('/'));
		} catch (err) {
			error = friendlyError(err);
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>{m.titulo_pagina({ pagina: m.restaurar_titulo_pagina() })}</title></svelte:head>

<main>
	<h1>{m.restaurar_titulo()}</h1>
	<p class="hint">{m.restaurar_dica()}</p>
	<form onsubmit={submit}>
		<PhraseInput id="frase" bind:value={phrase} />
		<label for="nome">{m.comum_seu_nome()}</label>
		<input id="nome" maxlength="40" autocomplete="nickname" required bind:value={name} />
		<p class="hint">{m.restaurar_nome_dica()}</p>
		<PinInput id="pin" label={m.restaurar_pin_rotulo()} bind:value={pin} oncomplete={() => pinAgainInput?.focus()} />
		<PinInput
			bind:this={pinAgainInput}
			id="pin2"
			label={m.comum_pin_repetir()}
			bind:value={pinAgain}
			error={!!error && !pinAgain}
			shakes={pinShakes}
			oncomplete={() => pin !== pinAgain && pinMismatch()}
		/>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<div class="actions">
			<button class="primary" type="submit" disabled={busy}>{busy ? m.restaurar_recuperando() : m.restaurar_recuperar()}</button>
			<a href={resolve('/bem-vindo')}>{m.comum_voltar()}</a>
		</div>
	</form>
</main>
