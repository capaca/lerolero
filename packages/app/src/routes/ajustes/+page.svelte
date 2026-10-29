<script lang="ts">
	import Avatar from '#lib/components/Avatar.svelte';
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
	import { readTextSize, saveTextSize, type TextSize } from '#lib/text-size.ts';

	const npub = $derived(session.identity ? toNpub(session.identity.publicKey) : '');

	// medição da prova de trabalho (RNF-18), só no app em dev: calibra a dificuldade no celular do Pedro
	const POW_BITS = [12, 14, 16];
	const POW_RUNS = 10;
	let powResults = $state<{ bits: number; mean: number; max: number }[]>([]);
	let measuring = $state(false);
	async function measurePow() {
		measuring = true;
		powResults = [];
		try {
			for (const bits of POW_BITS) {
				const times = await session.measurePow(bits, POW_RUNS);
				powResults = [...powResults, { bits, mean: Math.round(times.reduce((a, b) => a + b, 0) / times.length), max: Math.max(...times) }];
			}
		} finally {
			measuring = false;
		}
	}
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

	// tamanho da letra (RNF-65): só deste aparelho
	let textSize = $state<TextSize>(readTextSize());
	const sizeOptions: { value: TextSize; label: () => string }[] = [
		{ value: 'normal', label: () => m.ajustes_letra_normal() },
		{ value: 'grande', label: () => m.ajustes_letra_grande() },
		{ value: 'muito_grande', label: () => m.ajustes_letra_muito_grande() }
	];

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
		<div class="me">
			<Avatar name={session.identity?.displayName} publicKey={session.identity?.publicKey ?? ''} size={56} />
			<div>
				<p><Rich text={m.ajustes_nome({ nome: session.identity?.displayName ?? '' })} /></p>
				<a href={resolve('/ajustes/perfil')}>{m.ajustes_editar_perfil()}</a>
			</div>
		</div>
		<p class="hint">{m.ajustes_chave_dica()}</p>
		<p class="key">{npub}</p>
		<button onclick={copy}>{copied ? m.ajustes_chave_copiada() : m.ajustes_copiar_chave()}</button>
	</section>

	<section class="card">
		<h2>{m.ajustes_letra()}</h2>
		<div class="sizes" role="radiogroup" aria-label={m.ajustes_letra()}>
			{#each sizeOptions as option (option.value)}
				<label class="size" class:on={textSize === option.value}>
					<input
						type="radio"
						name="tamanho-da-letra"
						value={option.value}
						bind:group={textSize}
						onchange={() => saveTextSize(textSize)}
					/>
					<span>{option.label()}</span>
				</label>
			{/each}
		</div>
		<p class="hint">{m.ajustes_letra_dica()}</p>
	</section>

	<section class="card">
		<h2>{m.ajustes_seguranca()}</h2>
		<div class="actions stack">
			<a href={resolve('/ajustes/protecao')}>
				{m.ajustes_protecao()} ·
				<span class:warn={!session.identity?.phraseConfirmed}>
					{session.identity?.phraseConfirmed ? m.ajustes_protecao_ok() : m.ajustes_protecao_falta()}
				</span>
			</a>
			<button onclick={lock}>{m.ajustes_bloquear_agora()}</button>
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

	{#if __APP_LOCAL__}
		<section class="card">
			<h2>{m.ajustes_pow_titulo()}</h2>
			<p class="hint">{m.ajustes_pow_dica({ n: POW_RUNS })}</p>
			{#each powResults as r (r.bits)}
				<p>{m.ajustes_pow_resultado({ bits: r.bits, media: r.mean, max: r.max })}</p>
			{/each}
			<button onclick={measurePow} disabled={measuring}>{measuring ? m.ajustes_pow_medindo() : m.ajustes_pow_medir()}</button>
		</section>
	{/if}

	<p class="hint release">
		{(__APP_HOMOLOG__ ? m.ajustes_versao_homologacao : __APP_LOCAL__ ? m.ajustes_versao_local : m.ajustes_versao)({ versao: __APP_RELEASE__ })}
	</p>
</main>

<style>
	.warn {
		color: var(--danger);
		font-weight: 600;
	}
	.me {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		margin-bottom: 0.75rem;
	}
	.me p {
		margin: 0 0 0.25rem;
	}
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
	.sizes {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.size {
		flex: 1;
		margin: 0;
		min-width: 6rem;
		position: relative; /* âncora do rádio escondido, que senão alarga a página */
		padding: 0.6rem 0.5rem;
		text-align: center;
		border: 1px solid var(--line);
		border-radius: 10px;
		cursor: pointer;
	}
	.size.on {
		border-color: var(--accent);
		box-shadow: inset 0 0 0 1px var(--accent);
	}
	.size input {
		position: absolute;
		opacity: 0;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		pointer-events: none;
	}
	.size:has(input:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
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
