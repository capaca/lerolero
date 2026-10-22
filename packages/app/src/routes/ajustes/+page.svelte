<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toNpub } from '@lerolero/core';
	import { relayList } from '#lib/relays.ts';
	import { session } from '#lib/session.svelte.ts';

	const npub = $derived(session.identity ? toNpub(session.identity.publicKey) : '');
	let copied = $state(false);

	const relays = relayList();

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
	<p><a href={resolve('/')}>← Voltar</a></p>
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
	</section>
</main>

<style>
	.key {
		font-family: ui-monospace, monospace;
		font-size: 0.85rem;
		overflow-wrap: anywhere;
	}
</style>
