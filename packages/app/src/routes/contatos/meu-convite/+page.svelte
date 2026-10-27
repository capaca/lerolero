<script lang="ts">
	import BackLink from '#lib/components/BackLink.svelte';
	import { resolve } from '$app/paths';
	import { inviteLink } from '@lerolero/core';
	import { onMount } from 'svelte';
	import QrCode from '#lib/components/QrCode.svelte';
	import { appUrl } from '#lib/app-url.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { session } from '#lib/session.svelte.ts';

	let link = $state('');
	let copied = $state(false);
	const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

	onMount(async () => (link = inviteLink(appUrl(), await session.myInvite())));

	async function share() {
		try {
			await navigator.share({ title: m.app_nome(), text: m.meuconvite_texto(), url: link });
		} catch {
			// a pessoa cancelou o compartilhamento
		}
	}

	async function copy() {
		await navigator.clipboard.writeText(link);
		copied = true;
	}
</script>

<svelte:head><title>{m.titulo_pagina({ pagina: m.contatos_meu_convite() })}</title></svelte:head>

<main>
	<BackLink href={resolve('/contatos')} label={m.contatos_titulo()} />
	<h1>{m.contatos_meu_convite()}</h1>
	<p>{m.meuconvite_dica()}</p>
	{#if link}
		<QrCode text={link} label={m.meuconvite_qr()} />
		<div class="actions">
			{#if canShare}<button class="primary" onclick={share}>{m.meuconvite_compartilhar()}</button>{/if}
			<button onclick={copy}>{copied ? m.meuconvite_copiado() : m.meuconvite_copiar()}</button>
		</div>
		<p class="hint">{m.meuconvite_explicacao()}</p>
	{/if}
</main>
