<script lang="ts">
	// Aberta uma vez, ao ganhar o primeiro contato (Q-U1): é quando passa a haver algo a perder.
	// "Depois" adia o lembrete da tela inicial (RF-04) e segue para o contato. O jeito principal é o arquivo ou o
	// cartão (RF-09 a); anotar as palavras e conferir duas continua como alternativa.
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import PhraseBackup from '#lib/components/PhraseBackup.svelte';
	import PhraseCheck from '#lib/components/PhraseCheck.svelte';
	import PhraseReveal from '#lib/components/PhraseReveal.svelte';
	import RecoveryFile from '#lib/components/RecoveryFile.svelte';
	import { markPhraseOffered, snoozePhraseReminder } from '#lib/phrase-reminder.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { session } from '#lib/session.svelte.ts';

	type Step = 'aviso' | 'pin' | 'arquivo' | 'frase' | 'teste';
	let step = $state<Step>('aviso');
	let words = $state<string[]>([]);
	let wroteItDown = $state(false);

	// só uma chave de contato vira destino, para a página não servir de redirecionamento
	const contact = page.url.searchParams.get('contato') ?? '';
	const next = /^[0-9a-f]{64}$/.test(contact) ? resolve('/contatos/[chave]', { chave: contact }) : resolve('/');

	onMount(() => void markPhraseOffered());

	async function later() {
		await snoozePhraseReminder();
		await goto(next, { replaceState: true });
	}

	async function confirmed() {
		await session.confirmPhrase();
		await goto(next, { replaceState: true });
	}
</script>

<svelte:head><title>{m.titulo_pagina({ pagina: m.frase_guardar_titulo_pagina() })}</title></svelte:head>

<main>
	{#if step === 'aviso'}
		<h1>{m.frase_guardar_titulo()}</h1>
		<p>{m.frase_guardar_explicacao()}</p>
		<p class="hint">{m.frase_guardar_dica()}</p>
		<div class="actions stack">
			<button class="primary" onclick={() => (step = 'pin')}>{m.inicio_frase_guardar()}</button>
			<button onclick={later}>{m.frase_depois()}</button>
		</div>
	{:else if step === 'pin'}
		<h1>{m.frase_guardar_titulo()}</h1>
		<PhraseReveal
			label={m.protecao_pin_rotulo()}
			action={m.comum_continuar()}
			onrevealed={(w) => {
				words = w;
				step = 'arquivo';
			}}
		/>
	{:else if step === 'arquivo'}
		<h1>{m.frase_guardar_titulo()}</h1>
		<RecoveryFile {words} onsaved={confirmed} onwrite={() => (step = 'frase')} />
		<button class="link" onclick={later}>{m.frase_fazer_depois()}</button>
	{:else if step === 'frase'}
		<h1>{m.frase_sua()}</h1>
		<PhraseBackup {words} />
		<label class="check"><input type="checkbox" bind:checked={wroteItDown} /> {m.frase_guardei()}</label>
		<div class="actions">
			<button class="primary" disabled={!wroteItDown} onclick={() => (step = 'teste')}>{m.comum_continuar()}</button>
		</div>
	{:else}
		<h1>{m.frase_confira_titulo()}</h1>
		<PhraseCheck {words} onconfirmed={confirmed} />
		<button class="link" onclick={later}>{m.frase_fazer_depois()}</button>
		<p class="hint">{m.frase_lembrar_dica()}</p>
	{/if}
</main>

<style>
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
</style>
