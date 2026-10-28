<script lang="ts">
	import BackLink from '#lib/components/BackLink.svelte';
	import Rich from '#lib/components/Rich.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toNpub } from '@lerolero/core';
	import { formatIsoDay } from '#lib/format.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { relayList } from '#lib/relays.ts';
	import { READ_RECEIPTS_KEY, session } from '#lib/session.svelte.ts';
	import { FEEDBACK_FORM_URL, FEEDBACK_INVITE } from '#lib/teste.ts';

	const npub = $derived(session.identity ? toNpub(session.identity.publicKey) : '');
	let copied = $state(false);

	const relays = relayList();

	// confirmação de leitura (RF-51): ligada por padrão
	let readReceipts = $state(true);
	$effect(() => {
		void session.readReceiptsOn().then((on) => (readReceipts = on));
	});
	function toggleReceipts() {
		void session.setSetting(READ_RECEIPTS_KEY, readReceipts);
	}

	// estado da rede, atualizado a cada 2 s enquanto a tela está aberta
	let connected = $state<string[]>([]);
	$effect(() => {
		connected = session.connectedRelays();
		const timer = setInterval(() => (connected = session.connectedRelays()), 2000);
		return () => clearInterval(timer);
	});

	async function copy() {
		await navigator.clipboard.writeText(npub);
		copied = true;
	}

	async function lock() {
		await session.lock();
		await goto(resolve('/desbloquear'));
	}
</script>

<svelte:head><title>{m.titulo_pagina({ pagina: m.inicio_ajustes() })}</title></svelte:head>

<main>
	<BackLink href={resolve('/')} label={m.comum_inicio()} />
	<h1>{m.inicio_ajustes()}</h1>

	<section class="card">
		<h2>{m.ajustes_conta()}</h2>
		<p><Rich text={m.ajustes_nome({ nome: session.identity?.displayName ?? '' })} /></p>
		<p class="hint">{m.ajustes_chave_dica()}</p>
		<p class="key">{npub}</p>
		<button onclick={copy}>{copied ? m.ajustes_chave_copiada() : m.ajustes_copiar_chave()}</button>
	</section>

	<section class="card">
		<h2>{m.ajustes_seguranca()}</h2>
		<div class="actions stack">
			<a href={resolve('/ajustes/frase')}>
				{session.identity?.phraseConfirmed ? m.ajustes_ver_frase() : m.ajustes_conferir_frase()}
			</a>
			<button onclick={lock}>{m.ajustes_bloquear_agora()}</button>
		</div>
	</section>

	<section class="card">
		<div class="actions stack">
			<a href={resolve('/ajustes/favoritas')}>{m.ajustes_favoritas()}</a>
		</div>
	</section>

	<section class="card">
		<h2>{m.ajustes_privacidade()}</h2>
		<label class="check">
			<input type="checkbox" bind:checked={readReceipts} onchange={toggleReceipts} />
			<span>{m.ajustes_leitura()}</span>
		</label>
		<p class="hint">{m.ajustes_leitura_dica()}</p>
	</section>

	<section class="card">
		<h2>{m.ajustes_teste()}</h2>
		<div class="actions stack">
			{#if FEEDBACK_INVITE || FEEDBACK_FORM_URL}
				<a href={resolve('/ajustes/comentario')}>{m.ajustes_comentario()}</a>
			{/if}
			<a href={resolve('/teste')}>{m.ajustes_como_testar()}</a>
		</div>
	</section>

	<section class="card">
		<h2>{m.ajustes_servidores()}</h2>
		{#await relays}
			<p class="hint">{m.comum_carregando()}</p>
		{:then list}
			<p>
				{m.ajustes_lista({ relays: m.ajustes_relays({ count: list.dm.length }), midia: m.ajustes_midia({ count: list.blossom.length }) })}
				<span class="hint">{m.ajustes_lista_data({ data: formatIsoDay(list.atualizado) })}</span>
			</p>
		{:catch}
			<p class="error">{m.ajustes_erro_lista()}</p>
		{/await}
		<p><Rich text={m.ajustes_conectado({ count: connected.length })} /></p>
		{#if connected.length}
			<ul class="hint relays">
				{#each connected as url (url)}<li>{url.replace('wss://', '')}</li>{/each}
			</ul>
		{/if}
	</section>

	<p class="hint release">
		{(__APP_HOMOLOG__ ? m.ajustes_versao_homologacao : m.ajustes_versao)({ versao: __APP_RELEASE__ })}
	</p>
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
	.release {
		text-align: center;
	}
	.relays {
		margin: 0;
		padding-left: 1.2rem;
	}
	.key {
		font-family: ui-monospace, monospace;
		font-size: 0.85rem;
		overflow-wrap: anywhere;
	}
</style>
