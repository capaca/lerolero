<script lang="ts">
	import BackLink from '#lib/components/BackLink.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toNpub } from '@lerolero/core';
	import { relayList } from '#lib/relays.ts';
	import { session } from '#lib/session.svelte.ts';
	import { FEEDBACK_FORM_URL, FEEDBACK_INVITE } from '#lib/teste.ts';

	const npub = $derived(session.identity ? toNpub(session.identity.publicKey) : '');
	let copied = $state(false);

	const relays = relayList();

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

<svelte:head><title>Ajustes · Lero-lero</title></svelte:head>

<main>
	<BackLink href={resolve('/')} label="Início" />
	<h1>Ajustes</h1>

	<section class="card">
		<h2>Sua conta</h2>
		<p>Nome: <strong>{session.identity?.displayName}</strong></p>
		<p class="hint">Sua chave pública (identifica você na rede):</p>
		<p class="key">{npub}</p>
		<button onclick={copy}>{copied ? 'Copiada!' : 'Copiar chave'}</button>
	</section>

	<section class="card">
		<h2>Segurança</h2>
		<div class="actions stack">
			<a href={resolve('/ajustes/frase')}>
				{session.identity?.phraseConfirmed ? 'Ver minha frase de recuperação' : 'Conferir minha frase de recuperação'}
			</a>
			<button onclick={lock}>Bloquear agora</button>
		</div>
	</section>

	<section class="card">
		<h2>Teste</h2>
		<div class="actions stack">
			{#if FEEDBACK_INVITE || FEEDBACK_FORM_URL}
				<a href={resolve('/ajustes/comentario')}>Enviar comentário (bug ou sugestão)</a>
			{/if}
			<a href={resolve('/teste')}>Como testar</a>
		</div>
	</section>

	<section class="card">
		<h2>Servidores</h2>
		{#await relays}
			<p class="hint">Carregando…</p>
		{:then list}
			<p>
				{list.dm.length} relays para mensagens e {list.blossom.length} servidores para mídia
				<span class="hint">(lista de {list.atualizado})</span>.
			</p>
		{:catch}
			<p class="error">Não foi possível carregar a lista de servidores.</p>
		{/await}
		<p>
			Conectado agora a <strong>{connected.length}</strong>
			{connected.length === 1 ? 'servidor' : 'servidores'}.
		</p>
		{#if connected.length}
			<ul class="hint relays">
				{#each connected as url (url)}<li>{url.replace('wss://', '')}</li>{/each}
			</ul>
		{/if}
	</section>

	<p class="hint release">Lero-lero {__APP_RELEASE__}</p>
</main>

<style>
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
