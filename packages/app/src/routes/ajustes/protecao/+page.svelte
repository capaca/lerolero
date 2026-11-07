<script lang="ts">
	// "Proteção da conta" (RF-09, ADR-0009): o estado numa tela só e as camadas para proteger. Uma camada concluída
	// basta para o lembrete do RF-04 parar: o gerenciador de senhas (D1), o arquivo ou cartão (D2) e as palavras anotadas à mão.
	import TopBar from '#lib/components/TopBar.svelte';
	import { resolve } from '$app/paths';
	import PasswordSave from '#lib/components/PasswordSave.svelte';
	import PhraseReveal from '#lib/components/PhraseReveal.svelte';
	import PhraseWrite from '#lib/components/PhraseWrite.svelte';
	import RecoveryFile from '#lib/components/RecoveryFile.svelte';
	import Rich from '#lib/components/Rich.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { session } from '#lib/session.svelte.ts';

	let words = $state<string[]>([]);
	let done = $state(false);
	// "Prefiro anotar as palavras": a frase aparece aqui mesmo, com as palavras que o PIN já revelou (item 26)
	let writing = $state(false);

	async function saved() {
		await session.confirmPhrase();
		words = [];
		writing = false;
		done = true;
	}
</script>

<svelte:head><title>{m.titulo_pagina({ pagina: m.protecao_titulo() })}</title></svelte:head>

<TopBar title={m.protecao_titulo()} back={resolve('/ajustes')} backTo={m.inicio_ajustes()} />

<main>

	{#if done}
		<p class="ok" role="status"><Rich text={m.protecao_pronto()} /></p>
	{:else if session.identity?.phraseConfirmed}
		<p class="ok"><Rich text={m.protecao_protegida()} /></p>
		<p class="hint">{m.protecao_de_novo()}</p>
	{:else if words.length === 0}
		<div class="banner"><p><Rich text={m.protecao_falta()} /></p></div>
		<p>{m.protecao_explicacao()}</p>
	{:else if !writing}
		<div class="banner"><p><Rich text={m.protecao_escolha()} /></p></div>
	{/if}

	{#if words.length === 0}
		{#if !done}<PhraseReveal label={m.protecao_pin_rotulo()} onrevealed={(w) => (words = w)} />{/if}
	{:else if writing}
		<PhraseWrite {words} onconfirmed={saved} />
	{:else}
		<!-- as camadas como uma lista de escolhas, a mais fácil em destaque (item 26); anotar mostra as palavras -->
		<PasswordSave {words} onsaved={saved} />
		<RecoveryFile {words} onsaved={saved} onwrite={() => (writing = true)} />
	{/if}
</main>

<style>
	.ok {
		border-left: 4px solid var(--accent);
		padding-left: 0.75rem;
	}
</style>
