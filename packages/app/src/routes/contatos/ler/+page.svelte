<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import TopBar from '#lib/components/TopBar.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { parseInvite } from '@lerolero/core';
	import { onDestroy, tick } from 'svelte';
	import { startScanner } from '#lib/scanner.ts';
	import { friendlyError } from '#lib/errors.ts';
	import { m } from '#lib/paraglide/messages.js';

	let video = $state<HTMLVideoElement>();
	let scanning = $state(false);
	let pasting = $state(false);
	let pasted = $state('');
	let error = $state('');
	let stop: (() => void) | undefined;

	// o convite segue, como veio, para a mesma tela de quem abre um link: um único lugar decide
	// o que fazer, e um convite antigo (nprofile) não perde os relays no caminho
	async function open(text: string) {
		try {
			parseInvite(text); // valida antes de sair desta tela
			const raw = text.trim();
			const fragment = raw.includes('#') ? raw.slice(raw.indexOf('#') + 1) : raw;
			await goto(resolve('/convite') + '#' + fragment);
		} catch (err) {
			error = friendlyError(err);
		}
	}

	async function scan() {
		error = '';
		pasting = false;
		scanning = true;
		try {
			await tick(); // o vídeo só existe depois que a tela troca
			stop = await startScanner(video!, (text) => {
				scanning = false;
				void open(text);
			});
		} catch {
			scanning = false;
			pasting = true; // o erro manda colar o link
			error = m.ler_erro_camera();
		}
	}

	function submitPaste(event: SubmitEvent) {
		event.preventDefault();
		void open(pasted);
	}

	onDestroy(() => stop?.());
</script>

<svelte:head><title>{m.titulo_pagina({ pagina: m.contatos_adicionar() })}</title></svelte:head>

<TopBar title={m.contatos_adicionar()} back={resolve('/contatos')} backTo={m.contatos_titulo()} />

<main>
	<!-- os dois jeitos como opções, a câmera em destaque (item 26); colar abre o campo do link -->
	{#if scanning}
		<!-- svelte-ignore a11y_media_has_caption -->
		<video bind:this={video} playsinline muted></video>
		<p class="hint">{m.ler_aponte()}</p>
		<button onclick={() => (stop?.(), (scanning = false))}>{m.comum_cancelar()}</button>
	{:else}
		<div class="options">
			<button class="option best" onclick={scan}>
				<span class="option-icon"><Icon name="scan" /></span>
				<span class="option-text"><b>{m.ler_qr_titulo()}</b><small>{m.ler_qr_dica()}</small></span>
				<Icon name="chevron-right" size={18} />
			</button>
			<button class="option" aria-expanded={pasting} onclick={() => ((pasting = true), (error = ''))}>
				<span class="option-icon"><Icon name="copy" /></span>
				<span class="option-text"><b>{m.ler_colar_titulo()}</b><small>{m.ler_colar_dica()}</small></span>
				<Icon name="chevron-right" size={18} />
			</button>
		</div>
		{#if pasting}
			<form onsubmit={submitPaste}>
				<label for="link">{m.ler_link_rotulo()}</label>
				<!-- svelte-ignore a11y_autofocus -->
				<input id="link" autocomplete="off" autofocus placeholder={m.ler_link_placeholder()} bind:value={pasted} />
				<div class="actions"><button class="primary" type="submit" disabled={!pasted.trim()}>{m.ler_abrir_convite()}</button></div>
			</form>
		{/if}
	{/if}

	{#if error}<p class="error" role="alert">{error}</p>{/if}
</main>

<style>
	video {
		width: 100%;
		max-width: 420px;
		border-radius: 12px;
		background: black;
		margin-bottom: 0.6rem;
	}
</style>
