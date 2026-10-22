<script lang="ts">
	import '../app.css';
	import { goto } from '$app/navigation';
	import { asset, resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { session, type Status } from '#lib/session.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// rotas permitidas em cada estado; fora delas, vai para a primeira
	const ALLOWED: Record<Exclude<Status, 'carregando'>, string[]> = {
		'sem-identidade': ['/bem-vindo', '/cadastro', '/restaurar'],
		bloqueado: ['/desbloquear', '/esqueci-pin'],
		// /cadastro continua aberto: depois do PIN a pessoa ainda vê e confere a frase
		desbloqueado: ['/', '/cadastro', '/ajustes', '/ajustes/frase']
	};

	onMount(() => void session.init());

	$effect(() => {
		if (session.status === 'carregando') return;
		const allowed = ALLOWED[session.status];
		if (!allowed.includes(page.route.id ?? '')) void goto(resolve(allowed[0] as '/'), { replaceState: true });
	});
</script>

<svelte:head>
	<link rel="icon" href={asset('icon-192.png')} />
</svelte:head>

{#if session.status !== 'carregando'}
	{@render children()}
{/if}
