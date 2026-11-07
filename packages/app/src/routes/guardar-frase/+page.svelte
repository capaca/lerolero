<script lang="ts">
	// Aberta uma vez, ao ganhar o primeiro contato (Q-U1): é quando passa a haver algo a perder.
	// "Depois" adia o lembrete da tela inicial (RF-04) e segue para o contato. Os jeitos principais são o gerenciador de
	// senhas (RF-09 b) e o arquivo ou o cartão (RF-09 a); anotar as palavras e conferir duas continua como alternativa.
	// Em passos, como o cadastro (item 26): PIN, o jeito de guardar e, se for anotar, as palavras.
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import PasswordSave from '#lib/components/PasswordSave.svelte';
	import PhraseReveal from '#lib/components/PhraseReveal.svelte';
	import PhraseWrite from '#lib/components/PhraseWrite.svelte';
	import RecoveryFile from '#lib/components/RecoveryFile.svelte';
	import StepHeader from '#lib/components/StepHeader.svelte';
	import { markPhraseOffered, snoozePhraseReminder } from '#lib/phrase-reminder.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { session } from '#lib/session.svelte.ts';

	type Step = 'aviso' | 'pin' | 'arquivo' | 'frase';
	let step = $state<Step>('aviso');
	let words = $state<string[]>([]);
	let checking = $state(false);

	// só uma chave de contato vira destino, para a página não servir de redirecionamento
	const contact = page.url.searchParams.get('contato') ?? '';
	const next = /^[0-9a-f]{64}$/.test(contact) ? resolve('/contatos/[chave]', { chave: contact }) : resolve('/');

	onMount(() => void markPhraseOffered());

	async function later() {
		await snoozePhraseReminder();
		await goto(next, { replaceState: true });
	}

	// voltar do jeito de guardar vai ao aviso, e não ao PIN: as palavras saem da tela e o PIN é pedido de novo
	function back() {
		if (step === 'frase' && checking) checking = false;
		else if (step === 'frase') step = 'arquivo';
		else {
			words = [];
			step = 'aviso';
		}
	}

	async function confirmed() {
		await session.confirmPhrase();
		await goto(next, { replaceState: true });
	}
</script>

<svelte:head><title>{m.titulo_pagina({ pagina: m.frase_guardar_titulo_pagina() })}</title></svelte:head>

<main class="flow">
	{#if step === 'aviso'}
		<h1>{m.frase_guardar_titulo()}</h1>
		<p>{m.frase_guardar_explicacao()}</p>
		<p class="hint">{m.frase_guardar_dica()}</p>
		<div class="bottom">
			<button class="primary" onclick={() => (step = 'pin')}>{m.inicio_frase_guardar()}</button>
			<button onclick={later}>{m.frase_depois()}</button>
		</div>
	{:else}
		<StepHeader current={step === 'pin' ? 1 : step === 'arquivo' ? 2 : 3} total={3} onback={back} />
		{#if step === 'pin'}
			<h1>{m.frase_guardar_titulo()}</h1>
			<PhraseReveal
				label={m.protecao_pin_rotulo()}
				onrevealed={(w) => {
					words = w;
					step = 'arquivo';
				}}
			/>
		{:else if step === 'arquivo'}
			<h1>{m.frase_guardar_titulo()}</h1>
			<PasswordSave {words} onsaved={confirmed} />
			<RecoveryFile {words} onsaved={confirmed} onwrite={() => (step = 'frase')} />
			<button class="link" onclick={later}>{m.frase_fazer_depois()}</button>
		{:else}
			<h1>{checking ? m.frase_confira_titulo() : m.frase_sua()}</h1>
			<PhraseWrite {words} bind:checking onconfirmed={confirmed} />
			{#if checking}
				<button class="link" onclick={later}>{m.frase_fazer_depois()}</button>
				<p class="hint">{m.frase_lembrar_dica()}</p>
			{/if}
		{/if}
	{/if}
</main>
