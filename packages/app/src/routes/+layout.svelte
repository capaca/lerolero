<script lang="ts">
	import '../app.css';
	import { goto } from '$app/navigation';
	import { asset, resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { savePendingInvite } from '#lib/pending-invite.ts';
	import { session, type Status } from '#lib/session.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// versão nova do app ativada pelo service worker: avisa em vez de recarregar sozinho,
	// para não perder uma mensagem que a pessoa esteja digitando
	let updateReady = $state(false);
	const showOffline = $derived(session.status === 'desbloqueado' && session.offline);

	// rotas permitidas em cada estado; fora delas, vai para a primeira
	const ALLOWED: Record<Exclude<Status, 'carregando'>, string[]> = {
		'sem-identidade': ['/bem-vindo', '/cadastro', '/restaurar'],
		bloqueado: ['/desbloquear', '/esqueci-pin'],
		desbloqueado: [
			'/',
			'/ajustes',
			'/ajustes/frase',
			'/ajustes/comentario',
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
		void session.init();
		// RF-80: ao voltar para o app ou quando a internet volta, reconecta e esvazia a fila
		// a primeira troca de controle numa página sem worker é a instalação, não uma versão nova
		let controlled = !!navigator.serviceWorker?.controller;
		const onControllerChange = () => {
			if (controlled) updateReady = true;
			controlled = true;
		};
		navigator.serviceWorker?.addEventListener('controllerchange', onControllerChange);
		const checkForUpdate = () => void navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {});

		const resume = () => {
			if (document.visibilityState !== 'visible') return;
			session.resumeNetwork();
			checkForUpdate();
		};
		// sessão aberta (recarregar sem PIN): o prazo conta de quando o app saiu da tela
		const touch = () => void session.touchSession();
		const onVisibility = () => (document.visibilityState === 'visible' ? resume() : touch());
		const touchTimer = setInterval(touch, 60_000);
		document.addEventListener('visibilitychange', onVisibility);
		addEventListener('pagehide', touch);
		addEventListener('online', resume);
		return () => {
			clearInterval(touchTimer);
			removeEventListener('pagehide', touch);
			navigator.serviceWorker?.removeEventListener('controllerchange', onControllerChange);
			document.removeEventListener('visibilitychange', onVisibility);
			removeEventListener('online', resume);
		};
	});

	$effect(() => {
		if (session.status === 'carregando') return;
		const allowed = ALLOWED[session.status];
		const route = page.route.id ?? '';
		if (allowed.includes(route) || PUBLIC.includes(route)) return;
		// convite aberto sem estar dentro do app: retomado no início, depois de entrar
		if (route === '/convite') savePendingInvite(location.hash);
		void goto(resolve(allowed[0] as '/'), { replaceState: true });
	});
</script>

<svelte:head>
	<link rel="icon" href={asset('icon-192.png')} />
</svelte:head>

{#if showOffline}
	<!-- faixa fina presa no topo, no fluxo da página: não cobre nada nem fica no meio da tela -->
	<p class="offline" role="status">Sem conexão. As mensagens saem quando voltar.</p>
{/if}

{#if updateReady}
	<div class="update" role="status">
		<span>Nova versão disponível.</span>
		<button onclick={() => location.reload()}>Atualizar</button>
	</div>
{/if}

{#if session.status !== 'carregando'}
	<!-- a conversa ocupa a altura da tela; com a faixa de sem conexão ela encolhe o mesmo tanto -->
	<div style:--offline-bar={showOffline ? '1.75rem' : '0px'}>
		{@render children()}
	</div>
{/if}

{#if __APP_HOMOLOG__}
	<!-- moldura laranja: esta é a homologação, com outra conta, e não o app de verdade (ADR-0007) -->
	<p class="homolog" aria-hidden="true"><span>Homologação</span></p>
{/if}

<style>
	.offline {
		position: sticky;
		top: 0;
		z-index: 20;
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
	.homolog {
		position: fixed;
		inset: 0;
		margin: 0;
		border: 3px solid #c2410c;
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
		background: #c2410c;
		color: #fff;
		font-size: 0.65rem;
		font-weight: 600;
	}
</style>
