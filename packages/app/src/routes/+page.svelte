<script lang="ts">
	import { asset } from '$app/paths';
	import { loadRelayList, type RelayList } from '@lerolero/core';
	import embedded from '../../static/relays.json';

	// a lista vem da rede, para poder mudar sem nova versão do app (RNF-36);
	// a cópia embutida no app é a reserva se o site estiver fora do ar
	const relays: Promise<RelayList> = loadRelayList(embedded, async () => {
		const res = await fetch(asset('relays.json'), { cache: 'no-cache' });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return res.json();
	});
</script>

<svelte:head>
	<title>Lero-lero</title>
</svelte:head>

<main>
	<h1>Lero-lero</h1>
	<p>Mensagens privadas, sem dono e sem telefone.</p>
	<p class="hint">Em construção: esta é a fundação do app (M0). Ainda não dá para conversar.</p>

	<section>
		<h2>Lista padrão de servidores</h2>
		{#await relays}
			<p class="hint">Carregando…</p>
		{:then list}
			<p>
				{list.dm.length} relays para mensagens e {list.blossom.length} servidores para mídia
				<span class="hint">(atualizada em {list.atualizado})</span>.
			</p>
		{:catch error}
			<p class="err">Não foi possível carregar a lista: {error.message}</p>
		{/await}
	</section>
</main>

<style>
	:global(body) {
		margin: 0;
		background: #fafaf7;
		color: #1d1d1b;
		font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
		line-height: 1.45;
	}
	@media (prefers-color-scheme: dark) {
		:global(body) {
			background: #161615;
			color: #ececea;
		}
	}
	main {
		max-width: 640px;
		margin: 0 auto;
		padding: 16px;
	}
	h1 {
		color: #1f6f5c;
	}
	h2 {
		font-size: 1.05rem;
	}
	.hint {
		opacity: 0.7;
		font-size: 0.9rem;
	}
	.err {
		color: #b3261e;
	}
</style>
