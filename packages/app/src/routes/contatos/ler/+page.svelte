<script lang="ts">
	import BackLink from '#lib/components/BackLink.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { parseInvite } from '@lerolero/core';
	import { onDestroy } from 'svelte';
	import { startScanner } from '#lib/scanner.ts';
	import { friendlyError } from '#lib/errors.ts';
	import { m } from '#lib/paraglide/messages.js';

	let video = $state<HTMLVideoElement>();
	let scanning = $state(false);
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
		scanning = true;
		try {
			stop = await startScanner(video!, (text) => {
				scanning = false;
				void open(text);
			});
		} catch {
			scanning = false;
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

<main>
	<BackLink href={resolve('/contatos')} label={m.contatos_titulo()} />
	<h1>{m.contatos_adicionar()}</h1>

	<section>
		<h2>{m.ler_qr_titulo()}</h2>
		<!-- svelte-ignore a11y_media_has_caption -->
		<video bind:this={video} playsinline muted class:hidden={!scanning}></video>
		{#if !scanning}
			<button class="primary" onclick={scan}>{m.ler_abrir_camera()}</button>
		{:else}
			<p class="hint">{m.ler_aponte()}</p>
			<button onclick={() => (stop?.(), (scanning = false))}>{m.comum_cancelar()}</button>
		{/if}
	</section>

	<section>
		<h2>{m.ler_colar_titulo()}</h2>
		<form onsubmit={submitPaste}>
			<label for="link">{m.ler_link_rotulo()}</label>
			<input id="link" autocomplete="off" placeholder={m.ler_link_placeholder()} bind:value={pasted} />
			<div class="actions"><button type="submit" disabled={!pasted.trim()}>{m.ler_abrir_convite()}</button></div>
		</form>
	</section>

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
	.hidden {
		display: none;
	}
	section {
		margin: 1.5rem 0;
	}
</style>
