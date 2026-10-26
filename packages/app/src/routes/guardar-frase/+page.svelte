<script lang="ts">
	// Aberta uma vez, ao ganhar o primeiro contato (Q-U1): é quando passa a haver algo a perder.
	// "Depois" adia o lembrete da tela inicial (RF-04) e segue para o contato.
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import PhraseBackup from '#lib/components/PhraseBackup.svelte';
	import PhraseCheck from '#lib/components/PhraseCheck.svelte';
	import PhraseReveal from '#lib/components/PhraseReveal.svelte';
	import { markPhraseOffered, snoozePhraseReminder } from '#lib/phrase-reminder.ts';
	import { session } from '#lib/session.svelte.ts';

	type Step = 'aviso' | 'pin' | 'frase' | 'teste';
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

<svelte:head><title>Guarde sua frase · Lero-lero</title></svelte:head>

<main>
	{#if step === 'aviso'}
		<h1>Guarde sua frase de recuperação</h1>
		<p>
			Agora você tem contatos no Lero-lero. Se perder o celular ou esquecer o PIN, só uma frase de 12 palavras
			recupera sua conta e seus contatos.
		</p>
		<p class="hint">Leva um minuto: você anota as palavras e confere duas delas.</p>
		<div class="actions stack">
			<button class="primary" onclick={() => (step = 'pin')}>Guardar agora</button>
			<button onclick={later}>Depois</button>
		</div>
	{:else if step === 'pin'}
		<h1>Guarde sua frase de recuperação</h1>
		<PhraseReveal
			onrevealed={(w) => {
				words = w;
				step = 'frase';
			}}
		/>
	{:else if step === 'frase'}
		<h1>Sua frase de recuperação</h1>
		<PhraseBackup {words} />
		<label class="check"><input type="checkbox" bind:checked={wroteItDown} /> Guardei as 12 palavras</label>
		<div class="actions">
			<button class="primary" disabled={!wroteItDown} onclick={() => (step = 'teste')}>Continuar</button>
		</div>
	{:else}
		<h1>Confira sua frase</h1>
		<PhraseCheck {words} onconfirmed={confirmed} />
		<button class="link" onclick={later}>Fazer depois</button>
		<p class="hint">Se deixar para depois, vamos lembrar você até conferir.</p>
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
