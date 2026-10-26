<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import PinInput from '#lib/components/PinInput.svelte';
	import { friendlyError } from '#lib/errors.ts';
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
		error = 'Os dois PINs não são iguais.';
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
		if (pin.length !== 6) return (error = 'O PIN precisa ter 6 números.');
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

<svelte:head><title>Criar conta · Lero-lero</title></svelte:head>

<main>
	{#if step === 'nome'}
		<h1>Como quer ser chamado?</h1>
		<form onsubmit={submitName}>
			<label for="nome">Seu nome</label>
			<!-- svelte-ignore a11y_autofocus -->
			<input id="nome" maxlength="40" autocomplete="nickname" required autofocus bind:value={name} />
			<p class="hint">Só seus contatos veem esse nome. Ele não fica público na internet.</p>
			<div class="actions"><button class="primary" type="submit">Continuar</button></div>
		</form>
	{:else}
		<h1>Crie um PIN</h1>
		<p class="hint">
			O PIN protege sua conta neste aparelho e será pedido sempre que você abrir o app. Não use datas de
			aniversário nem 123456.
		</p>
		<form bind:this={pinForm} onsubmit={submitPin}>
			<PinInput id="pin" label="PIN de 6 números" bind:value={pin} autofocus oncomplete={() => pinAgainInput?.focus()} />
			<PinInput
				bind:this={pinAgainInput}
				id="pin2"
				label="Digite o PIN de novo"
				bind:value={pinAgain}
				error={!!error && !pinAgain}
				shakes={pinShakes}
				oncomplete={() => (pin === pinAgain ? pinForm?.requestSubmit() : pinMismatch())}
			/>
			{#if error}<p class="error" role="alert">{error}</p>{/if}
			<div class="actions">
				<button class="primary" type="submit" disabled={step === 'criando'}>
					{step === 'criando' ? 'Criando sua conta…' : 'Criar conta'}
				</button>
			</div>
		</form>
	{/if}
</main>
