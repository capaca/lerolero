<script lang="ts">
	import { goto, replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { phraseFromFragment, phraseFromRecoveryText } from '@lerolero/core';
	import { onMount, tick } from 'svelte';
	import { canReadSavedPhrase, savedPhrase } from '#lib/components/PasswordSave.svelte';
	import PhraseInput from '#lib/components/PhraseInput.svelte';
	import PinInput from '#lib/components/PinInput.svelte';
	import { friendlyError } from '#lib/errors.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { session } from '#lib/session.svelte.ts';

	let phrase = $state('');
	let name = $state('');
	let pin = $state('');
	let pinAgain = $state('');
	let busy = $state(false);
	let error = $state('');
	/** frase aceita sem backup com o nome (RF-06): falta só o nome; o motivo muda o aviso */
	let missingName = $state<'sem-backup' | 'sem-rede'>();

	// restaurar pelo link ou pelo arquivo de recuperação (RF-09 a): as palavras chegam prontas, falta o PIN
	let fromFile = $state(false);
	let fileError = $state(false);
	let fileInput = $state<HTMLInputElement>();
	function fill(words: string[] | undefined) {
		fileError = !words;
		savedMissing = false;
		if (!words) return;
		phrase = words.join(' ');
		fromFile = true;
		void tick().then(() => document.getElementById('pin')?.focus());
	}

	onMount(() => {
		if (!location.hash) return;
		const words = phraseFromFragment(location.hash);
		// as palavras saem do endereço na hora, para não ficarem no histórico do navegador (T21)
		replaceState(location.pathname + location.search, {});
		if (words) fill(words);
	});

	async function openFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		// um arquivo de recuperação tem menos de 2 KB; não lê nada muito maior
		if (file) fill(file.size < 64_000 ? phraseFromRecoveryText(await file.text()) : undefined);
	}

	// o código salvo no gerenciador de senhas (RF-09 b, ADR-0009 D1): o Chrome o entrega por credentials.get, também
	// quando foi salvo em outro aparelho da mesma conta Google
	const canUseSaved = canReadSavedPhrase();
	let savedMissing = $state(false);
	async function useSaved() {
		fileError = false;
		const saved = await savedPhrase().catch(() => undefined);
		savedMissing = !saved;
		if (saved) fill(saved.trim().split(/\s+/));
	}

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
			const result = await session.restore(phrase, pin);
			if (result !== 'pronto') return void (missingName = result);
			await goto(resolve('/'));
		} catch (err) {
			error = friendlyError(err);
		} finally {
			busy = false;
		}
	}

	async function submitName(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = '';
		try {
			await session.finishRestore(name.trim());
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
	{#if missingName}
		<p class="hint">{missingName === 'sem-rede' ? m.restaurar_backup_depois() : m.restaurar_sem_backup()}</p>
		<form onsubmit={submitName}>
			<label for="nome">{m.comum_seu_nome()}</label>
			<!-- svelte-ignore a11y_autofocus -->
			<input id="nome" maxlength="40" autocomplete="nickname" required autofocus bind:value={name} />
			<p class="hint">{m.restaurar_nome_dica()}</p>
			{#if error}<p class="error" role="alert">{error}</p>{/if}
			<div class="actions">
				<button class="primary" type="submit" disabled={busy}>{m.restaurar_entrar()}</button>
			</div>
		</form>
	{:else}
		{#if fromFile}
			<p role="status">{m.restaurar_do_arquivo()}</p>
		{:else}
			<p class="hint">{m.restaurar_dica()}</p>
		{/if}
		<div class="actions file">
			{#if canUseSaved}<button type="button" onclick={useSaved}>{m.restaurar_usar_senha()}</button>{/if}
			<button type="button" onclick={() => fileInput?.click()}>{m.restaurar_abrir_arquivo()}</button>
			<input bind:this={fileInput} type="file" accept=".txt,text/plain" hidden onchange={openFile} />
		</div>
		{#if fileError}<p class="error" role="alert">{m.restaurar_arquivo_invalido()}</p>{/if}
		{#if savedMissing}<p class="error" role="alert">{m.restaurar_senha_nada()}</p>{/if}
		<form onsubmit={submit}>
			<PhraseInput id="frase" bind:value={phrase} />
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
	{/if}
</main>

<style>
	.file {
		margin-bottom: 1rem;
	}
</style>
