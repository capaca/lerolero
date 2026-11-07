<script lang="ts">
	import '@fontsource-variable/outfit';
	import '../app.css';
	import { goto } from '$app/navigation';
	import { asset, resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { announcements } from '#lib/announcements.svelte.ts';
	import { language } from '#lib/i18n.svelte.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { savePendingInvite } from '#lib/pending-invite.ts';
	import { savePendingRoute, takePendingRoute } from '#lib/pending-route.ts';
	import { session, type Status } from '#lib/session.svelte.ts';
	import { applyTextSize, readTextSize } from '#lib/text-size.ts';
	import Icon from '#lib/components/Icon.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import type { LayoutProps } from './$types';

	// app em dev: a barra do celular na cor do "Lero local" (o manifest já sai com ela, vite.config.ts)
	if (__APP_LOCAL__) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', __APP_LOCAL_COLOR__);

	let { children }: LayoutProps = $props();

	// versão nova do app ativada pelo service worker: avisa em vez de recarregar sozinho,
	// para não perder uma mensagem que a pessoa esteja digitando
	let updateReady = $state(false);
	const showOffline = $derived(session.status === 'desbloqueado' && session.offline);
	// altura das faixas do topo (sem conexão e aviso), que a conversa desconta da tela
	let barsHeight = $state(0);

	// P5: backup nos relays com o que este aparelho não tem; fechar sem escolher deixa para a próxima abertura
	let backupLater = $state(false);
	let backupBusy = $state(false);
	const backupConflict = $derived(session.status === 'desbloqueado' && !backupLater ? session.backupConflict : undefined);
	const backupItems = $derived.by(() => {
		if (!backupConflict) return '';
		const parts = [
			...(backupConflict.contacts ? [m.backup_achado_contatos({ count: backupConflict.contacts })] : []),
			...(backupConflict.groups ? [m.backup_achado_grupos({ count: backupConflict.groups })] : [])
		];
		return parts.length === 2 ? m.backup_achado_e({ a: parts[0], b: parts[1] }) : parts[0];
	});

	async function resolveBackup(keep: boolean) {
		backupBusy = true;
		try {
			await (keep ? session.keepOldBackup() : session.discardOldBackup());
		} finally {
			backupBusy = false;
		}
	}

	const UPDATE_CHECK_MS = 5 * 60_000;

	// rotas permitidas em cada estado; fora delas, vai para a primeira
	const ALLOWED: Record<Exclude<Status, 'carregando' | 'erro'>, string[]> = {
		'sem-identidade': ['/bem-vindo', '/cadastro', '/restaurar'],
		bloqueado: ['/desbloquear', '/esqueci-pin'],
		desbloqueado: [
			'/',
			'/ajustes',
			'/ajustes/protecao',
			'/ajustes/comentario',
			'/ajustes/perfil',
			'/favoritas',
			'/contatos',
			'/contatos/meu-convite',
			'/contatos/ler',
			'/contatos/[chave]',
			'/convite',
			'/guardar-frase',
			'/conversa/[chave]',
			'/grupo/novo',
			'/grupo/[id]',
			'/grupo/[id]/detalhes',
			'/grupo/[id]/adicionar'
		]
	};

	// abertas em qualquer estado, sem conta: o guia e o roteiro do teste
	const PUBLIC = ['/teste', '/teste/roteiro'];

	onMount(() => {
		// o app.html nasce em pt-BR; a língua escolhida ou a do navegador vale a partir daqui (ADR-0008)
		document.documentElement.lang = language.current;
		applyTextSize(readTextSize());
		void session.init();
		void announcements.refresh();
		// RF-80: ao voltar para o app ou quando a internet volta, reconecta e esvazia a fila
		// a primeira troca de controle numa página sem worker é a instalação, não uma versão nova
		let controlled = !!navigator.serviceWorker?.controller;
		const onControllerChange = () => {
			if (controlled) updateReady = true;
			controlled = true;
		};
		navigator.serviceWorker?.addEventListener('controllerchange', onControllerChange);
		// toque numa notificação com o app já aberto: o service worker pede a conversa, sem recarregar (que tranca o cofre)
		const onWorkerMessage = (event: MessageEvent<{ tipo?: string; caminho?: string }>) => {
			const path = event.data?.caminho;
			if (event.data?.tipo === 'abrir' && path?.startsWith(resolve('/'))) void goto(path);
		};
		navigator.serviceWorker?.addEventListener('message', onWorkerMessage);
		const checkForUpdate = () => void navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {});

		const resume = () => {
			if (document.visibilityState !== 'visible') return;
			session.resumeNetwork();
			checkForUpdate();
			void announcements.refresh();
		};
		// sessão aberta (recarregar sem PIN): o prazo conta de quando o app saiu da tela
		const touch = () => void session.touchSession();
		const onVisibility = () => (document.visibilityState === 'visible' ? resume() : touch());
		const touchTimer = setInterval(touch, 60_000);
		// com o app sempre aberto, as correções não esperariam a pessoa sair e voltar; fora da tela não gasta franquia
		const updateTimer = setInterval(() => {
			if (document.visibilityState !== 'visible') return;
			checkForUpdate();
			void announcements.refresh();
		}, UPDATE_CHECK_MS);
		document.addEventListener('visibilitychange', onVisibility);
		addEventListener('pagehide', touch);
		addEventListener('online', resume);
		return () => {
			clearInterval(touchTimer);
			clearInterval(updateTimer);
			removeEventListener('pagehide', touch);
			navigator.serviceWorker?.removeEventListener('controllerchange', onControllerChange);
			navigator.serviceWorker?.removeEventListener('message', onWorkerMessage);
			document.removeEventListener('visibilitychange', onVisibility);
			removeEventListener('online', resume);
		};
	});

	$effect(() => {
		if (session.status === 'carregando' || session.status === 'erro') return;
		const allowed = ALLOWED[session.status];
		const route = page.route.id ?? '';
		if (allowed.includes(route) || PUBLIC.includes(route)) return;
		// convite aberto sem estar dentro do app: retomado no início, depois de entrar
		if (route === '/convite') savePendingInvite(location.hash);
		// conversa aberta pela notificação com o app bloqueado: abre depois do PIN
		else if (session.status === 'bloqueado' && route !== '/' && ALLOWED.desbloqueado.includes(route)) savePendingRoute(location.pathname);
		const next = session.status === 'desbloqueado' ? takePendingRoute() : undefined;
		void goto(next ?? resolve(allowed[0] as '/'), { replaceState: true });
	});
</script>

<svelte:head>
	<link rel="icon" href={asset('icon.svg')} type="image/svg+xml" />
	{#if session.status === 'erro'}<title>{m.titulo_pagina({ pagina: m.erro_abrir_titulo() })}</title>{/if}
</svelte:head>

<!-- faixas presas no topo, no fluxo da página: não cobrem nada nem ficam no meio da tela -->
<div class="bars" bind:clientHeight={barsHeight}>
	{#if showOffline}
		<p class="offline" role="status">{m.layout_sem_conexao()}</p>
	{/if}
	<!-- P9: aviso do Pedro a todos, em qualquer tela, inclusive antes de entrar e na de erro do P8 -->
	{#if announcements.current}
		{@const notice = announcements.current}
		<div class="notice" class:problem={notice.nivel === 'problema'} role="status">
			<p>{notice.texto}</p>
			<button type="button" onclick={() => announcements.dismiss(notice.id)} aria-label={m.layout_aviso_fechar()}><Icon name="x" /></button>
		</div>
	{/if}
</div>

{#if updateReady}
	<div class="update" role="status">
		<span>{m.layout_versao_nova()}</span>
		<button onclick={() => location.reload()}>{m.layout_atualizar()}</button>
	</div>
{/if}

{#if backupConflict}
	<Sheet label={m.backup_achado_titulo()} onclose={() => (backupLater = true)}>
		<p><strong>{m.backup_achado_titulo()}</strong></p>
		<p>{m.backup_achado_texto({ itens: backupItems, total: backupConflict.contacts + backupConflict.groups })}</p>
		<div class="actions stack">
			<button class="primary" disabled={backupBusy} onclick={() => resolveBackup(true)}>{m.backup_achado_trazer()}</button>
			<button class="link" disabled={backupBusy} onclick={() => resolveBackup(false)}>{m.backup_achado_descartar()}</button>
		</div>
	</Sheet>
{/if}

{#if session.status === 'erro'}
	<!-- P8: o banco não abriu. Os dados continuam no aparelho: nunca oferecer apagar, só tentar de novo -->
	<main>
		<h1>{m.erro_abrir_titulo()}</h1>
		<p>{m.erro_abrir_texto()}</p>
		<p class="hint">{m.erro_abrir_avisar()}</p>
		<pre class="error-detail">{session.initError}</pre>
		<p class="hint">
			{(__APP_HOMOLOG__ ? m.ajustes_versao_homologacao : __APP_LOCAL__ ? m.ajustes_versao_local : m.ajustes_versao)({ versao: __APP_RELEASE__ })}
		</p>
		<div class="actions">
			<button class="primary" onclick={() => location.reload()}>{m.erro_abrir_tentar()}</button>
		</div>
	</main>
{:else if session.status !== 'carregando'}
	<!-- a conversa ocupa a altura da tela; com as faixas do topo ela encolhe o mesmo tanto -->
	<div style:--top-bars="{barsHeight}px">
		<!-- trocar a língua redesenha a tela sem recarregar, que trancaria o cofre (ADR-0008) -->
		{#key language.current}
			{@render children()}
		{/key}
	</div>
{/if}

{#if __APP_HOMOLOG__}
	<!-- moldura laranja: esta é a homologação, com outra conta, e não o app de verdade (ADR-0007) -->
	<p class="homolog" aria-hidden="true"><span>{m.layout_homologacao()}</span></p>
{:else if __APP_LOCAL__}
	<!-- moldura roxa: o app em dev (scripts/celular.sh), com outra conta -->
	<p class="homolog local" aria-hidden="true" style:--frame={__APP_LOCAL_COLOR__}><span>{m.layout_local()}</span></p>
{/if}

<style>
	.bars {
		position: sticky;
		top: 0;
		z-index: 20;
	}
	.offline {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 1.75rem;
		margin: 0;
		padding: 0 0.75rem;
		background: var(--warn-bg);
		color: var(--warn-fg);
		border-bottom: 1px solid var(--line);
		font-size: 0.8rem;
		white-space: nowrap;
		overflow: hidden;
	}
	.notice {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.5rem 0.25rem 0.5rem 0.75rem;
		background: var(--surface);
		color: var(--fg);
		border-bottom: 1px solid var(--line);
		border-left: 4px solid var(--accent);
		font-size: 0.9rem;
	}
	.notice.problem {
		background: var(--danger);
		color: var(--danger-fg);
		border-left-color: var(--danger);
	}
	.notice p {
		flex: 1;
		margin: 0;
		padding-top: 0.15rem;
		white-space: pre-line;
		overflow-wrap: anywhere;
	}
	.notice button {
		flex: none;
		display: grid;
		place-items: center;
		width: 3rem;
		height: 3rem;
		margin: -0.6rem 0;
		padding: 0;
		border: none;
		background: none;
		color: inherit;
	}
	.update {
		position: fixed;
		left: 50%;
		bottom: calc(5rem + env(safe-area-inset-bottom));
		transform: translateX(-50%);
		z-index: 10;
		display: flex;
		align-items: center;
		gap: 0.8rem;
		padding: 0.6rem 0.7rem 0.6rem 1rem;
		border-radius: 999px;
		background: var(--fg);
		color: var(--bg);
		box-shadow: 0 4px 16px rgb(0 0 0 / 0.25);
		white-space: nowrap;
	}
	.update button {
		padding: 0.4rem 0.9rem;
		border-radius: 999px;
		border: none;
		background: var(--accent);
		color: var(--accent-fg);
	}
	.error-detail {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		padding: 0.6rem 0.8rem;
		border-radius: 8px;
		background: var(--warn-bg);
		color: var(--warn-fg);
		font-size: 0.85rem;
		user-select: all;
	}
	.homolog {
		position: fixed;
		inset: 0;
		margin: 0;
		border: 3px solid var(--frame, #c2410c);
		pointer-events: none;
		z-index: 100;
	}
	.homolog span {
		position: absolute;
		top: 0;
		left: 50%;
		transform: translateX(-50%);
		padding: 0 0.5rem 0.1rem;
		border-radius: 0 0 6px 6px;
		background: var(--frame, #c2410c);
		color: #fff;
		font-size: 0.65rem;
		font-weight: 600;
	}
</style>
