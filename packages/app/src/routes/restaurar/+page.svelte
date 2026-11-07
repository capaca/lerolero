<script lang="ts">
	import { goto, replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { parsePhrase, phraseFromFragment, phraseFromRecoveryText } from '@lerolero/core';
	import { onMount } from 'svelte';
	import NewPin from '#lib/components/NewPin.svelte';
	import { canReadSavedPhrase, savedPhrase } from '#lib/components/PasswordSave.svelte';
	import PhraseInput from '#lib/components/PhraseInput.svelte';
	import StepHeader from '#lib/components/StepHeader.svelte';
	import { friendlyError } from '#lib/errors.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { session } from '#lib/session.svelte.ts';

	// frase → PIN → confirmação, um por vez, como no cadastro (item 26); o nome só se não houver backup (RF-06)
	type Step = 'frase' | 'pin' | 'recuperando';
	let step = $state<Step>('frase');
	let confirming = $state(false);
	let newPin = $state<NewPin>();
	let phrase = $state('');
	let name = $state('');
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
		error = '';
		step = 'pin';
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

	// a frase é conferida antes do PIN, para o erro aparecer ao lado dela
	function submitPhrase(event: SubmitEvent) {
		event.preventDefault();
		try {
			parsePhrase(phrase);
		} catch (err) {
			return void (error = friendlyError(err));
		}
		error = '';
		fromFile = false;
		step = 'pin';
	}

	function back() {
		if (confirming) newPin?.reset();
		else step = 'frase';
	}

	async function recover(pin: string) {
		step = 'recuperando';
		try {
			const result = await session.restore(phrase, pin);
			if (result !== 'pronto') return void (missingName = result);
			await goto(resolve('/'));
		} catch (err) {
			// o que falha aqui vem da frase (o PIN acabou de ser criado): volta para ela, com o erro
			error = friendlyError(err);
			fromFile = false;
			step = 'frase';
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

<main class:flow={!missingName}>
	{#if missingName}
		<h1>{m.restaurar_titulo()}</h1>
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
	{:else if step === 'frase'}
		<StepHeader current={1} total={2} href={resolve('/bem-vindo')} />
		<h1>{m.restaurar_titulo()}</h1>
		<p class="hint">{m.restaurar_dica()}</p>
		<div class="actions file">
			{#if canUseSaved}<button type="button" onclick={useSaved}>{m.restaurar_usar_senha()}</button>{/if}
			<button type="button" onclick={() => fileInput?.click()}>{m.restaurar_abrir_arquivo()}</button>
			<input bind:this={fileInput} type="file" accept=".txt,text/plain" hidden onchange={openFile} />
		</div>
		{#if fileError}<p class="error" role="alert">{m.restaurar_arquivo_invalido()}</p>{/if}
		{#if savedMissing}<p class="error" role="alert">{m.restaurar_senha_nada()}</p>{/if}
		<form onsubmit={submitPhrase}>
			<PhraseInput id="frase" bind:value={phrase} />
			{#if error}<p class="error" role="alert">{error}</p>{/if}
			<div class="bottom"><button class="primary" type="submit">{m.comum_continuar()}</button></div>
		</form>
	{:else}
		<StepHeader current={2} total={2} onback={back} disabled={step === 'recuperando'} />
		<h1>{confirming ? m.comum_pin_repetir() : m.cadastro_pin_titulo()}</h1>
		{#if fromFile && !confirming}
			<p class="hint" role="status">{m.restaurar_do_arquivo()}</p>
		{:else}
			<p class="hint">{confirming ? m.cadastro_pin_confirmar_dica() : m.restaurar_pin_dica()}</p>
		{/if}
		<form onsubmit={(event) => event.preventDefault()}>
			<NewPin
				bind:this={newPin}
				bind:confirming
				label={m.cadastro_pin_rotulo()}
				confirmLabel={m.comum_pin_repetir()}
				disabled={step === 'recuperando'}
				onconfirm={recover}
			/>
			{#if step === 'recuperando'}<p class="hint center" role="status">{m.restaurar_recuperando()}</p>{/if}
		</form>
	{/if}
</main>

<style>
	.file {
		margin-bottom: 1rem;
	}
</style>
