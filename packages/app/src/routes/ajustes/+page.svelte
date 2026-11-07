<script lang="ts">
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import TopBar from '#lib/components/TopBar.svelte';
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
	import { pushErrorMessage } from '#lib/push-offer.ts';
	import { pushSupport } from '#lib/push-subscription.ts';

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

	// notificações (RF-82, ADR-0010): só deste aparelho, desligadas até a pessoa pedir
	const support = pushSupport();
	let pushOn = $state(false);
	let pushBusy = $state(false);
	let pushError = $state('');
	$effect(() => {
		void session.pushEnabled().then((on) => (pushOn = on));
	});
	async function togglePush() {
		const want = pushOn;
		pushBusy = true;
		pushError = '';
		try {
			await (want ? session.enablePush() : session.disablePush());
		} catch (e) {
			pushOn = !want;
			pushError = pushErrorMessage(e);
		} finally {
			pushBusy = false;
		}
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

<TopBar title={m.inicio_ajustes()} back={resolve('/')} backTo={m.comum_inicio()} />

<main>
	<!-- lista agrupada, como nos ajustes do celular (item 26): você no topo, numa linha só -->
	<a class="me" href={resolve('/ajustes/perfil')}>
		<Avatar name={session.identity?.displayName} publicKey={session.identity?.publicKey ?? ''} size={56} />
		<span class="row-text"><b>{session.identity?.displayName}</b><small class="link-like">{m.ajustes_editar_perfil()}</small></span>
		<Icon name="chevron-right" size={18} />
	</a>

	{#if !session.identity?.phraseConfirmed}
		<div class="banner alert">
			<p><Rich text={m.ajustes_alerta_protecao()} /></p>
			<a class="go" href={resolve('/ajustes/protecao')}>{m.ajustes_proteger_agora()}</a>
		</div>
	{/if}

	<h2 class="group-label">{m.ajustes_conversas()}</h2>
	<div class="group">
		{#if support === 'sim'}
			<label class="row">
				<span class="row-icon"><Icon name="bell" /></span>
				<span class="row-text">{m.ajustes_notificacoes_ativar()}<small>{m.ajustes_notificacoes_dica()}</small></span>
				<input class="switch" type="checkbox" bind:checked={pushOn} onchange={togglePush} disabled={pushBusy} />
			</label>
			{#if pushError}<p class="error row-note" role="alert">{pushError}</p>{/if}
		{:else}
			<div class="row">
				<span class="row-icon"><Icon name="bell" /></span>
				<span class="row-text">{m.ajustes_notificacoes_ativar()}<small>{support === 'instalar' ? m.ajustes_notificacoes_instalar() : m.ajustes_notificacoes_sem_suporte()}</small></span>
			</div>
		{/if}
		<label class="row">
			<span class="row-icon"><Icon name="eye" /></span>
			<span class="row-text">{m.ajustes_leitura()}<small>{m.ajustes_leitura_dica()}</small></span>
			<input class="switch" type="checkbox" bind:checked={readReceipts} onchange={toggleReceipts} />
		</label>
		<div class="row column">
			<span class="row-head"><span class="row-icon"><Icon name="type" /></span><span class="row-text" id="letra">{m.ajustes_letra()}<small>{m.ajustes_letra_dica()}</small></span></span>
			<div class="sizes" role="radiogroup" aria-labelledby="letra">
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
		</div>
	</div>

	<h2 class="group-label">{m.ajustes_seguranca()}</h2>
	<div class="group">
		<a class="row" href={resolve('/ajustes/protecao')}>
			<span class="row-icon"><Icon name="shield" /></span>
			<span class="row-text">{m.ajustes_protecao()}</span>
			<span class="value" class:warn={!session.identity?.phraseConfirmed}>
				{session.identity?.phraseConfirmed ? m.ajustes_protecao_ok() : m.ajustes_protecao_falta()}
			</span>
			<Icon name="chevron-right" size={18} />
		</a>
		<button class="row" onclick={lock}>
			<span class="row-icon"><Icon name="lock" /></span>
			<span class="row-text">{m.ajustes_bloquear_agora()}</span>
		</button>
	</div>

	<h2 class="group-label">{m.ajustes_teste()}</h2>
	<div class="group">
		{#if FEEDBACK_INVITE || FEEDBACK_FORM_URL}
			<a class="row" href={resolve('/ajustes/comentario')}>
				<span class="row-icon"><Icon name="message" /></span>
				<span class="row-text">{m.ajustes_comentario()}</span>
				<Icon name="chevron-right" size={18} />
			</a>
		{/if}
		<a class="row" href={resolve('/teste')}>
			<span class="row-icon"><Icon name="help" /></span>
			<span class="row-text">{m.ajustes_como_testar()}</span>
			<Icon name="chevron-right" size={18} />
		</a>
	</div>

<!-- chave e servidores ficam fora do fluxo padrão, fechados até quem quiser abrir (RNF-64) -->
	<details class="group technical">
		<summary class="row"><span class="row-icon"><Icon name="code" /></span><span class="row-text">{m.ajustes_detalhes()}</span><Icon name="chevron-down" size={18} /></summary>
		<div class="technical-body">
		<p class="hint">{m.ajustes_chave_dica()}</p>
		<p class="key">{npub}</p>
		<button onclick={copy}>{copied ? m.ajustes_chave_copiada() : m.ajustes_copiar_chave()}</button>
		<h3>{m.ajustes_servidores()}</h3>
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
		</div>
	</details>

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
	.me {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		padding: 0.8rem;
		border: 1px solid var(--line);
		border-radius: 14px;
		background: var(--surface);
		color: var(--fg);
		text-decoration: none;
	}
	.me b {
		font-size: 1.15rem;
	}
	.link-like {
		color: var(--accent);
	}
	.alert {
		margin-top: 1rem;
	}
	.alert p {
		margin: 0 0 0.6rem;
	}
	/* o botão do aviso usa as cores do próprio aviso, com 4,5:1 nos dois temas (WCAG 1.4.3) */
	.go {
		display: inline-flex;
		align-items: center;
		/* alvo de toque de 48 px (RNF-63) */
		min-height: 3rem;
		padding: 0 1rem;
		border-radius: 10px;
		background: var(--warn-fg);
		color: var(--warn-bg);
		font-weight: 700;
		text-decoration: none;
	}
	.group-label {
		margin: 1.5rem 0 0.4rem 0.25rem;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.group {
		border: 1px solid var(--line);
		border-radius: 14px;
		background: var(--surface);
		overflow: hidden;
	}
	.technical {
		margin-top: 1.5rem;
	}
	/* uma linha por ajuste: ícone, nome (com a explicação embaixo), o valor e a seta; 48 px de alvo (RNF-63) */
	.row {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		width: 100%;
		min-height: 3rem;
		margin: 0;
		padding: 0.75rem 0.9rem;
		border: 0;
		border-top: 1px solid var(--line);
		border-radius: 0;
		background: none;
		color: var(--fg);
		font: inherit;
		font-weight: 500;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}
	.group > .row:first-child,
	.technical > summary {
		border-top: 0;
	}
	.row.column {
		flex-direction: column;
		align-items: stretch;
		cursor: default;
	}
	.row-head {
		display: flex;
		align-items: center;
		gap: 0.8rem;
	}
	.row-icon {
		display: grid;
		flex: none;
		color: var(--accent);
	}
	.row-text {
		display: grid;
		flex: 1;
		min-width: 0;
		gap: 0.15rem;
	}
	.row-text small {
		color: var(--muted);
		font-size: 0.85rem;
		font-weight: 400;
	}
	.me > :global(svg:last-child),
	.row > :global(svg:last-child) {
		flex: none;
		color: var(--muted);
	}
	.row-note {
		margin: 0;
		padding: 0 0.9rem 0.75rem;
	}
	.value {
		color: var(--muted);
	}
	.warn {
		color: var(--danger);
		font-weight: 700;
	}
	/* tamanho da letra: seletor de três partes */
	.sizes {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(5.5rem, 1fr));
		border: 1px solid var(--line);
		border-radius: 10px;
		overflow: hidden;
	}
	.size {
		margin: 0;
		position: relative; /* âncora do rádio escondido, que senão alarga a página */
		display: grid;
		place-items: center;
		min-height: 3rem;
		padding: 0.4rem;
		text-align: center;
		font-weight: 600;
		border-left: 1px solid var(--line);
		cursor: pointer;
	}
	.size:first-child {
		border-left: 0;
	}
	.size.on {
		background: var(--accent);
		color: var(--accent-fg);
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
		outline: 3px solid var(--accent);
		outline-offset: -3px;
	}
	.release {
		text-align: center;
	}
	.technical summary {
		list-style: none;
	}
	.technical summary::-webkit-details-marker {
		display: none;
	}
	.technical-body {
		padding: 0 0.9rem 0.9rem;
	}
	.technical h3 {
		margin: 1.25rem 0 0.5rem;
		font-size: 1rem;
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
