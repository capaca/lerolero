<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { parsePhrase } from '@lerolero/core';
	import NewPin from '#lib/components/NewPin.svelte';
	import PhraseInput from '#lib/components/PhraseInput.svelte';
	import StepHeader from '#lib/components/StepHeader.svelte';
	import { friendlyError } from '#lib/errors.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { session } from '#lib/session.svelte.ts';

	// frase → PIN novo → confirmação, um por vez, como no cadastro (item 26)
	type Step = 'frase' | 'pin' | 'trocando';
	let step = $state<Step>('frase');
	let confirming = $state(false);
	let newPin = $state<NewPin>();
	let phrase = $state('');
	let error = $state('');

	// a frase é conferida antes do PIN, para o erro aparecer ao lado dela
	function submitPhrase(event: SubmitEvent) {
		event.preventDefault();
		try {
			parsePhrase(phrase);
		} catch (err) {
			return void (error = friendlyError(err));
		}
		error = '';
		step = 'pin';
	}

	function back() {
		if (confirming) newPin?.reset();
		else step = 'frase';
	}

	async function change(pin: string) {
		step = 'trocando';
		try {
			await session.resetPin(phrase, pin);
			await goto(resolve('/'));
		} catch (err) {
			// o que falha aqui vem da frase (de outra conta, por exemplo): volta para ela, com o erro
			error = friendlyError(err);
			step = 'frase';
		}
	}
</script>

<svelte:head><title>{m.titulo_pagina({ pagina: m.esqueci_titulo() })}</title></svelte:head>

<main class="flow">
	{#if step === 'frase'}
		<StepHeader current={1} total={2} href={resolve('/desbloquear')} />
		<h1>{m.esqueci_titulo()}</h1>
		<p class="hint">{m.esqueci_dica()}</p>
		<form onsubmit={submitPhrase}>
			<PhraseInput id="frase" bind:value={phrase} />
			{#if error}<p class="error" role="alert">{error}</p>{/if}
			<p class="hint">{m.esqueci_sem_frase()}</p>
			<div class="bottom"><button class="primary" type="submit">{m.comum_continuar()}</button></div>
		</form>
	{:else}
		<StepHeader current={2} total={2} onback={back} disabled={step === 'trocando'} />
		<h1>{confirming ? m.esqueci_pin_repetir() : m.esqueci_pin_titulo()}</h1>
		<p class="hint">{confirming ? m.cadastro_pin_confirmar_dica() : m.cadastro_pin_dica()}</p>
		<form onsubmit={(event) => event.preventDefault()}>
			<NewPin
				bind:this={newPin}
				bind:confirming
				label={m.cadastro_pin_rotulo()}
				confirmLabel={m.esqueci_pin_repetir()}
				disabled={step === 'trocando'}
				onconfirm={change}
			/>
			{#if step === 'trocando'}<p class="hint center" role="status">{m.esqueci_trocando()}</p>{/if}
		</form>
	{/if}
</main>
