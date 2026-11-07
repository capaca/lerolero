<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import NewPin from '#lib/components/NewPin.svelte';
	import PhotoPicker from '#lib/components/PhotoPicker.svelte';
	import StepHeader from '#lib/components/StepHeader.svelte';
	import { friendlyError } from '#lib/errors.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { session } from '#lib/session.svelte.ts';

	// nome (e foto, opcional) → PIN → confirmação, e já entra. A frase fica para quando houver algo a perder: o
	// primeiro contato abre "Guarde sua frase" (Q-U1, phrase-reminder.ts).
	type Step = 'nome' | 'pin' | 'criando';
	let step = $state<Step>('nome');
	let confirming = $state(false);
	let name = $state('');
	let photo = $state<Blob>();
	let preview = $state<string>();
	let newPin = $state<NewPin>();

	$effect(() => () => {
		if (preview) URL.revokeObjectURL(preview);
	});

	function pick(file: File) {
		if (preview) URL.revokeObjectURL(preview);
		photo = file;
		preview = URL.createObjectURL(file);
	}

	function submitName(event: SubmitEvent) {
		event.preventDefault();
		if (name.trim()) step = 'pin';
	}

	function back() {
		if (confirming) newPin?.reset();
		else step = 'nome';
	}

	async function create(pin: string) {
		step = 'criando';
		try {
			await session.create(name.trim(), pin);
		} catch (err) {
			step = 'pin';
			newPin?.reset(friendlyError(err));
			return;
		}
		// a foto sobe depois da conta, pela rede (Blossom), sem prender a entrada: o app já abre o início. Se falhar,
		// a pessoa põe a foto depois em Ajustes
		if (photo) void session.updateProfile(name, photo).catch(() => {});
		await goto(resolve('/'));
	}
</script>

<svelte:head><title>{m.titulo_pagina({ pagina: m.cadastro_titulo_pagina() })}</title></svelte:head>

<main class="flow">
	{#if step === 'nome'}
		<StepHeader current={1} total={2} href={resolve('/bem-vindo')} />
	{:else}
		<StepHeader current={2} total={2} onback={back} disabled={step === 'criando'} />
	{/if}

	{#if step === 'nome'}
		<h1>{m.cadastro_nome_titulo()}</h1>
		<form onsubmit={submitName}>
			<PhotoPicker {name} publicKey="" {preview} hasPhoto={!!photo} testid="foto-cadastro" onpick={pick} />
			<p class="hint center">{m.cadastro_foto_dica()}</p>

			<label for="nome">{m.comum_seu_nome()}</label>
			<!-- svelte-ignore a11y_autofocus -->
			<input id="nome" maxlength="40" autocomplete="nickname" required autofocus bind:value={name} />
			<p class="hint">{m.cadastro_nome_dica()}</p>
			<div class="bottom"><button class="primary" type="submit">{m.comum_continuar()}</button></div>
		</form>
	{:else}
		<h1>{confirming ? m.comum_pin_repetir() : m.cadastro_pin_titulo()}</h1>
		<p class="hint">{confirming ? m.cadastro_pin_confirmar_dica() : m.cadastro_pin_dica()}</p>
		<form onsubmit={(event) => event.preventDefault()}>
			<NewPin
				bind:this={newPin}
				bind:confirming
				label={m.cadastro_pin_rotulo()}
				confirmLabel={m.comum_pin_repetir()}
				disabled={step === 'criando'}
				onconfirm={create}
			/>
			{#if step === 'criando'}<p class="hint center" role="status">{m.cadastro_criando()}</p>{/if}
		</form>
	{/if}
</main>

