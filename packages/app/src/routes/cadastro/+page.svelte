<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import PhraseCheck from '#lib/components/PhraseCheck.svelte';
	import PhraseBackup from '#lib/components/PhraseBackup.svelte';
	import PinInput from '#lib/components/PinInput.svelte';
	import { friendlyError, session } from '#lib/session.svelte.ts';

	// nome → PIN → frase → teste. O PIN vem antes porque a frase já nasce lacrada com ele.
	type Step = 'nome' | 'pin' | 'criando' | 'frase' | 'teste';
	let step = $state<Step>('nome');
	let name = $state('');
	let pin = $state('');
	let pinAgain = $state('');
	let words = $state<string[]>([]);
	let wroteItDown = $state(false);
	let error = $state('');

	function submitName(event: SubmitEvent) {
		event.preventDefault();
		if (name.trim()) step = 'pin';
	}

	async function submitPin(event: SubmitEvent) {
		event.preventDefault();
		if (pin.length !== 6) return (error = 'O PIN precisa ter 6 números.');
		if (pin !== pinAgain) return (error = 'Os dois PINs não são iguais.');
		error = '';
		step = 'criando';
		try {
			words = await session.create(name.trim(), pin);
			step = 'frase';
		} catch (err) {
			error = friendlyError(err);
			step = 'pin';
		} finally {
			pin = pinAgain = '';
		}
	}

	async function confirmed() {
		await session.confirmPhrase();
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
	{:else if step === 'pin' || step === 'criando'}
		<h1>Crie um PIN</h1>
		<p class="hint">
			O PIN protege sua conta neste aparelho e será pedido sempre que você abrir o app. Não use datas de
			aniversário nem 123456.
		</p>
		<form onsubmit={submitPin}>
			<PinInput id="pin" label="PIN de 6 números" bind:value={pin} autofocus />
			<PinInput id="pin2" label="Digite o PIN de novo" bind:value={pinAgain} />
			{#if error}<p class="error" role="alert">{error}</p>{/if}
			<div class="actions">
				<button class="primary" type="submit" disabled={step === 'criando'}>
					{step === 'criando' ? 'Criando sua conta…' : 'Criar conta'}
				</button>
			</div>
		</form>
	{:else if step === 'frase'}
		<h1>Sua frase de recuperação</h1>
		<PhraseBackup {words} />
		<label class="check"><input type="checkbox" bind:checked={wroteItDown} /> Guardei as 12 palavras</label>
		<div class="actions">
			<button class="primary" disabled={!wroteItDown} onclick={() => (step = 'teste')}>Continuar</button>
		</div>
	{:else}
		<h1>Confira sua frase</h1>
		<PhraseCheck {words} onconfirmed={confirmed} />
		<button class="link" onclick={() => goto(resolve('/'))}>Fazer depois</button>
		<p class="hint">Se deixar para depois, vamos lembrar você até conferir.</p>
	{/if}
</main>

<style>
	.check {
		display: flex;
		gap: 0.6rem;
		align-items: center;
		font-weight: 500;
	}
	.check input {
		width: auto;
		transform: scale(1.3);
	}
</style>
