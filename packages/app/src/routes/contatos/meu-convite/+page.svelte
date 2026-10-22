<script lang="ts">
	import { resolve } from '$app/paths';
	import { inviteLink } from '@lerolero/core';
	import { onMount } from 'svelte';
	import QrCode from '#lib/components/QrCode.svelte';
	import { appUrl } from '#lib/app-url.ts';
	import { session } from '#lib/session.svelte.ts';

	let link = $state('');
	let copied = $state(false);
	const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

	onMount(async () => (link = inviteLink(appUrl(), await session.myInvite())));

	async function share() {
		try {
			await navigator.share({ title: 'Lero-lero', text: 'Fale comigo no Lero-lero:', url: link });
		} catch {
			// a pessoa cancelou o compartilhamento
		}
	}

	async function copy() {
		await navigator.clipboard.writeText(link);
		copied = true;
	}
</script>

<svelte:head><title>Meu convite · Lero-lero</title></svelte:head>

<main>
	<p><a href={resolve('/contatos')}>← Contatos</a></p>
	<h1>Meu convite</h1>
	<p>Mostre este QR code para a pessoa ler no app dela, ou mande o link por qualquer meio.</p>
	{#if link}
		<QrCode text={link} label="QR code do seu convite" />
		<div class="actions">
			{#if canShare}<button class="primary" onclick={share}>Compartilhar link</button>{/if}
			<button onclick={copy}>{copied ? 'Link copiado' : 'Copiar link'}</button>
		</div>
		<p class="hint">
			O convite tem seu nome, sua chave e onde você recebe mensagens. Não é segredo: quem tiver o link
			consegue te mandar mensagens, mas não consegue ler as suas.
		</p>
	{/if}
</main>
