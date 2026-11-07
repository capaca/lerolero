<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import NewPin from '#lib/components/NewPin.svelte';
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
	let picker: HTMLInputElement;

	$effect(() => () => {
		if (preview) URL.revokeObjectURL(preview);
	});

	function pick(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
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
			<!-- a bolinha mostra como os contatos vão ver; tocar nela escolhe a foto -->
			<button class="photo" type="button" onclick={() => picker.click()} aria-label={photo ? m.perfil_trocar_foto() : m.perfil_escolher_foto()}>
				{#if preview}
					<img src={preview} alt="" />
				{:else}
					<Avatar {name} publicKey="" size={96} />
				{/if}
				<span class="badge" aria-hidden="true"><Icon name="image" size={18} /></span>
			</button>
			<input bind:this={picker} type="file" accept="image/*" hidden onchange={pick} data-testid="foto-cadastro" />
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

<style>
	.photo {
		position: relative;
		align-self: center;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: none;
	}
	.photo img {
		display: block;
		width: 96px;
		height: 96px;
		border-radius: 50%;
		object-fit: cover;
	}
	.badge {
		position: absolute;
		right: -2px;
		bottom: -2px;
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		background: var(--accent);
		color: var(--accent-fg);
		border: 2px solid var(--bg);
	}
</style>
