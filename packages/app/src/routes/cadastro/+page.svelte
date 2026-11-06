<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import PinInput from '#lib/components/PinInput.svelte';
	import { friendlyError } from '#lib/errors.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { session } from '#lib/session.svelte.ts';

	// nome (e foto, opcional) → PIN → confirmação, e já entra. A frase fica para quando houver algo a perder: o
	// primeiro contato abre "Guarde sua frase" (Q-U1, phrase-reminder.ts).
	type Step = 'nome' | 'pin' | 'confirmar' | 'criando';
	let step = $state<Step>('nome');
	let name = $state('');
	let photo = $state<Blob>();
	let preview = $state<string>();
	let pin = $state('');
	let firstPin = '';
	let error = $state('');
	let shakes = $state(0);
	let pinInput = $state<PinInput>();
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
		error = '';
		pin = firstPin = '';
		step = step === 'confirmar' ? 'pin' : 'nome';
	}

	// um PIN por vez, no mesmo campo, como no bloqueio do celular (item 26): o foco não sai dele
	async function pinComplete() {
		if (step === 'pin') {
			firstPin = pin;
			pin = '';
			error = '';
			step = 'confirmar';
			return;
		}
		if (pin !== firstPin) {
			// não bateu: treme e volta ao começo, porque não dá para saber qual dos dois saiu errado
			error = m.cadastro_pins_diferentes();
			pin = firstPin = '';
			shakes++;
			navigator.vibrate?.(150);
			step = 'pin';
			void pinInput?.focus();
			return;
		}
		step = 'criando';
		try {
			await session.create(name.trim(), pin);
		} catch (err) {
			error = friendlyError(err);
			pin = firstPin = '';
			step = 'pin';
			return;
		} finally {
			pin = firstPin = '';
		}
		// a foto sobe depois da conta, pela rede (Blossom), sem prender a entrada: o app já abre o início. Se falhar,
		// a pessoa põe a foto depois em Ajustes
		if (photo) void session.updateProfile(name, photo).catch(() => {});
		await goto(resolve('/'));
	}
</script>

<svelte:head><title>{m.titulo_pagina({ pagina: m.cadastro_titulo_pagina() })}</title></svelte:head>

<main class="signup">
	<div class="progress">
		{#if step === 'nome'}
			<a class="back" href={resolve('/bem-vindo')} aria-label={m.comum_voltar()}><Icon name="back" size={22} /></a>
		{:else}
			<button class="back" type="button" onclick={back} disabled={step === 'criando'} aria-label={m.comum_voltar()}><Icon name="back" size={22} /></button>
		{/if}
		<span class="label">{m.cadastro_passo({ atual: step === 'nome' ? 1 : 2, total: 2 })}</span>
		<span class="bar" aria-hidden="true"><i style:width={step === 'nome' ? '50%' : '100%'}></i></span>
	</div>

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
		<h1>{step === 'pin' ? m.cadastro_pin_titulo() : m.comum_pin_repetir()}</h1>
		<p class="hint">{step === 'pin' ? m.cadastro_pin_dica() : m.cadastro_pin_confirmar_dica()}</p>
		<form onsubmit={(event) => event.preventDefault()}>
			<PinInput
				bind:this={pinInput}
				id="pin"
				label={step === 'pin' ? m.cadastro_pin_rotulo() : m.comum_pin_repetir()}
				bind:value={pin}
				autofocus
				center
				disabled={step === 'criando'}
				error={!!error && !pin}
				{shakes}
				oncomplete={pinComplete}
			/>
			{#if error}<p class="error center" role="alert">{error}</p>{/if}
			{#if step === 'criando'}<p class="hint center" role="status">{m.cadastro_criando()}</p>{/if}
		</form>
	{/if}
</main>

<style>
	.signup {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
	}
	.signup form {
		display: flex;
		flex-direction: column;
		flex: 1;
	}
	.progress {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		column-gap: 0.5rem;
		font-size: 0.85rem;
		color: var(--muted);
	}
	/* alvo de toque de 48 px (RNF-63) */
	.back {
		grid-row: span 2;
		display: grid;
		place-items: center;
		width: 3rem;
		height: 3rem;
		margin-left: -0.75rem;
		padding: 0;
		border: 0;
		background: none;
		color: var(--fg);
	}
	.bar {
		height: 6px;
		border-radius: 999px;
		background: var(--line);
		overflow: hidden;
	}
	.bar i {
		display: block;
		height: 100%;
		border-radius: 999px;
		background: var(--accent);
		transition: width 0.3s;
	}
	h1 {
		margin-top: 1.25rem;
	}
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
	.center {
		text-align: center;
	}
	/* "Continuar" largo e embaixo, logo acima do teclado */
	.bottom {
		margin-top: auto;
		padding-top: 1.5rem;
		display: grid;
	}
</style>
