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

	// rotas permitidas em cada estado; fora delas, vai para a primeira
	const ALLOWED: Record<Exclude<Status, 'carregando'>, string[]> = {
		'sem-identidade': ['/bem-vindo', '/cadastro', '/restaurar'],
		bloqueado: ['/desbloquear', '/esqueci-pin'],
		// /cadastro continua aberto: depois do PIN a pessoa ainda vê e confere a frase
		desbloqueado: [
			'/',
			'/cadastro',
			'/ajustes',
			'/ajustes/frase',
			'/ajustes/comentario',
			'/contatos',
			'/contatos/meu-convite',
			'/contatos/ler',
			'/contatos/[chave]',
			'/convite',
			'/conversa/[chave]'
		]
	};

	// abertas em qualquer estado, sem conta: o guia e o roteiro do teste
	const PUBLIC = ['/teste', '/teste/roteiro'];

	onMount(() => {
		void session.init();
		// RF-80: ao voltar para o app ou quando a internet volta, reconecta e esvazia a fila
		const resume = () => document.visibilityState === 'visible' && session.resumeNetwork();
		document.addEventListener('visibilitychange', resume);
		addEventListener('online', resume);
		return () => {
			document.removeEventListener('visibilitychange', resume);
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

{#if session.status !== 'carregando'}
	{@render children()}
{/if}
