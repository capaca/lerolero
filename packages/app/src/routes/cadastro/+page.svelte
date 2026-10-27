<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import PinInput from '#lib/components/PinInput.svelte';
	import { friendlyError } from '#lib/errors.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { session } from '#lib/session.svelte.ts';

	// nome → PIN, e já entra. A frase fica para quando houver algo a perder: o primeiro
	// contato abre "Guarde sua frase" (Q-U1, phrase-reminder.ts).
	type Step = 'nome' | 'pin' | 'criando';
	let step = $state<Step>('nome');
	let name = $state('');
	let pin = $state('');
	let pinAgain = $state('');
	let error = $state('');
	let pinForm = $state<HTMLFormElement>();

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

	function submitName(event: SubmitEvent) {
		event.preventDefault();
		if (name.trim()) step = 'pin';
	}

	async function submitPin(event: SubmitEvent) {
		event.preventDefault();
		if (pin.length !== 6) return (error = m.erro_pin_tamanho());
		if (pin !== pinAgain) return pinMismatch();
		error = '';
		step = 'criando';
		try {
			await session.create(name.trim(), pin);
		} catch (err) {
			error = friendlyError(err);
			step = 'pin';
			return;
		} finally {
			pin = pinAgain = '';
		}
		await goto(resolve('/'));
	}
</script>

<svelte:head><title>{m.titulo_pagina({ pagina: m.cadastro_titulo_pagina() })}</title></svelte:head>

<main>
	{#if step === 'nome'}
		<h1>{m.cadastro_nome_titulo()}</h1>
		<form onsubmit={submitName}>
			<label for="nome">{m.comum_seu_nome()}</label>
			<!-- svelte-ignore a11y_autofocus -->
			<input id="nome" maxlength="40" autocomplete="nickname" required autofocus bind:value={name} />
			<p class="hint">{m.cadastro_nome_dica()}</p>
			<div class="actions"><button class="primary" type="submit">{m.comum_continuar()}</button></div>
		</form>
	{:else}
		<h1>{m.cadastro_pin_titulo()}</h1>
		<p class="hint">{m.cadastro_pin_dica()}</p>
		<form bind:this={pinForm} onsubmit={submitPin}>
			<PinInput id="pin" label={m.cadastro_pin_rotulo()} bind:value={pin} autofocus oncomplete={() => pinAgainInput?.focus()} />
			<PinInput
				bind:this={pinAgainInput}
				id="pin2"
				label={m.comum_pin_repetir()}
				bind:value={pinAgain}
				error={!!error && !pinAgain}
				shakes={pinShakes}
				oncomplete={() => (pin === pinAgain ? pinForm?.requestSubmit() : pinMismatch())}
			/>
			{#if error}<p class="error" role="alert">{error}</p>{/if}
			<div class="actions">
				<button class="primary" type="submit" disabled={step === 'criando'}>
					{step === 'criando' ? m.cadastro_criando() : m.cadastro_criar()}
				</button>
			</div>
		</form>
	{/if}
</main>
