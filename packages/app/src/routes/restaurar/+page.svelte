<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import PhraseInput from '#lib/components/PhraseInput.svelte';
	import PinInput from '#lib/components/PinInput.svelte';
	import { friendlyError, session } from '#lib/session.svelte.ts';

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
		error = 'Os dois PINs não são iguais.';
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

<svelte:head><title>Recuperar conta · Lero-lero</title></svelte:head>

<main>
	<h1>Recuperar minha conta</h1>
	<p class="hint">Digite as 12 palavras que você guardou quando criou a conta. Se estiverem num gerenciador de senhas, pode colar.</p>
	<form onsubmit={submit}>
		<PhraseInput id="frase" bind:value={phrase} />
		<label for="nome">Seu nome</label>
		<input id="nome" maxlength="40" autocomplete="nickname" required bind:value={name} />
		<p class="hint">O nome fica só no aparelho e com seus contatos; por isso pedimos de novo.</p>
		<PinInput id="pin" label="Crie um PIN de 6 números para este aparelho" bind:value={pin} oncomplete={() => pinAgainInput?.focus()} />
		<PinInput
			bind:this={pinAgainInput}
			id="pin2"
			label="Digite o PIN de novo"
			bind:value={pinAgain}
			error={!!error && !pinAgain}
			shakes={pinShakes}
			oncomplete={() => pin !== pinAgain && pinMismatch()}
		/>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<div class="actions">
			<button class="primary" type="submit" disabled={busy}>{busy ? 'Recuperando…' : 'Recuperar conta'}</button>
			<a href={resolve('/bem-vindo')}>Voltar</a>
		</div>
	</form>
</main>
