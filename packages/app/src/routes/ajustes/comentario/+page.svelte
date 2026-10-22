<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { version } from '$app/env';
	import { friendlyError, session } from '#lib/session.svelte.ts';
	import { FEEDBACK_CONTACT_NAME, FEEDBACK_FORM_URL, FEEDBACK_INVITE } from '#lib/teste.ts';

	const KINDS = ['Bug', 'Sugestão', 'Outro'] as const;
	let kind = $state<(typeof KINDS)[number]>('Bug');
	let text = $state('');
	let withDevice = $state(true);
	let busy = $state(false);
	let error = $state('');

	// dados que ajudam a reproduzir um problema; a pessoa vê e decide se manda
	const device = $derived(
		[
			`Navegador: ${navigator.userAgent}`,
			`Tela: ${screen.width}×${screen.height}, janela ${innerWidth}×${innerHeight}`,
			`Instalado: ${matchMedia('(display-mode: standalone)').matches ? 'sim' : 'não'}`,
			`Versão do app: ${version}`,
			`Servidores conectados: ${session.connectedRelays().length}`
		].join('\n')
	);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = '';
		const body = `[${kind}] ${text.trim()}${withDevice ? `\n\n— Dados do aparelho —\n${device}` : ''}`;
		try {
			const key = await session.sendFeedback(FEEDBACK_INVITE, FEEDBACK_CONTACT_NAME, body);
			await goto(resolve('/conversa/[chave]', { chave: key }));
		} catch (err) {
			error = friendlyError(err);
			busy = false;
		}
	}
</script>

<svelte:head><title>Enviar comentário · Lero-lero</title></svelte:head>

<main>
	<p><a href={resolve('/ajustes')}>← Ajustes</a></p>
	<h1>Enviar comentário</h1>
	{#if !FEEDBACK_INVITE}
		<p class="hint">O envio de comentários ainda não está configurado.</p>
	{:else}
		<p>
			Seu comentário vai cifrado para a equipe, como uma conversa: a resposta aparece em
			<strong>{FEEDBACK_CONTACT_NAME}</strong>.
		</p>
		<form onsubmit={submit}>
			<fieldset>
				<legend>Tipo</legend>
				{#each KINDS as k (k)}
					<label class="option"><input type="radio" name="tipo" value={k} bind:group={kind} /> {k}</label>
				{/each}
			</fieldset>
			<label for="texto">O que aconteceu ou o que você sugere?</label>
			<textarea id="texto" rows="6" required maxlength="3000" bind:value={text}></textarea>
			<p class="hint">
				Num bug, conte o que fez, o que apareceu e o que esperava. Nunca escreva sua frase de 12 palavras.
			</p>
			<label class="option"><input type="checkbox" bind:checked={withDevice} /> Incluir dados do aparelho</label>
			{#if withDevice}<pre class="hint device">{device}</pre>{/if}
			{#if error}<p class="error" role="alert">{error}</p>{/if}
			<div class="actions">
				<button class="primary" type="submit" disabled={busy || !text.trim()}>{busy ? 'Enviando…' : 'Enviar'}</button>
			</div>
		</form>
	{/if}
	{#if FEEDBACK_FORM_URL}
		<p class="hint">
			Quer mandar um print, ou o app não está funcionando? Use o
			<a href={FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer">formulário de retorno</a>.
		</p>
	{/if}
</main>

<style>
	fieldset {
		border: none;
		padding: 0;
		margin: 1rem 0 0;
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}
	legend {
		font-weight: 600;
		margin-bottom: 0.35rem;
	}
	.option {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-weight: 500;
		margin: 0.5rem 0;
	}
	.option input {
		width: auto;
	}
	.device {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		font-size: 0.78rem;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 8px;
		padding: 0.5rem;
	}
</style>
