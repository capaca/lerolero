<script lang="ts">
	// "Proteção da conta" (RF-09, ADR-0009): o estado numa tela só e as camadas para proteger. Uma camada concluída
	// basta para o lembrete do RF-04 parar: o gerenciador de senhas (D1), o arquivo ou cartão (D2) e as palavras anotadas à mão.
	import BackLink from '#lib/components/BackLink.svelte';
	import { resolve } from '$app/paths';
	import PasswordSave from '#lib/components/PasswordSave.svelte';
	import PhraseReveal from '#lib/components/PhraseReveal.svelte';
	import RecoveryFile from '#lib/components/RecoveryFile.svelte';
	import Rich from '#lib/components/Rich.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { session } from '#lib/session.svelte.ts';

	let words = $state<string[]>([]);
	let done = $state(false);

	async function saved() {
		await session.confirmPhrase();
		words = [];
		done = true;
	}
</script>

<svelte:head><title>{m.titulo_pagina({ pagina: m.protecao_titulo() })}</title></svelte:head>

<main>
	<BackLink href={resolve('/ajustes')} label={m.inicio_ajustes()} />
	<h1>{m.protecao_titulo()}</h1>

	{#if done}
		<p class="ok" role="status"><Rich text={m.protecao_pronto()} /></p>
	{:else if session.identity?.phraseConfirmed}
		<p class="ok"><Rich text={m.protecao_protegida()} /></p>
		<p class="hint">{m.protecao_de_novo()}</p>
	{:else}
		<div class="banner"><p><Rich text={m.protecao_falta()} /></p></div>
		<p>{m.protecao_explicacao()}</p>
	{/if}

	{#if words.length === 0}
		{#if !done}<PhraseReveal label={m.protecao_pin_rotulo()} action={m.comum_continuar()} onrevealed={(w) => (words = w)} />{/if}
	{:else}
		<PasswordSave {words} onsaved={saved} />
		<RecoveryFile {words} onsaved={saved} />
	{/if}

	<p class="other"><a href={resolve('/ajustes/frase')}>{m.protecao_ver_palavras()}</a></p>
</main>

<style>
	.ok {
		border-left: 4px solid var(--accent);
		padding-left: 0.75rem;
	}
	.other {
		margin-top: 1.5rem;
	}
</style>
