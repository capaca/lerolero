<script lang="ts">
	import BackLink from '#lib/components/BackLink.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { version } from '$app/env';
	import { friendlyError } from '#lib/errors.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { session } from '#lib/session.svelte.ts';
	import { FEEDBACK_FORM_URL, FEEDBACK_INVITE } from '#lib/teste.ts';
	import Rich from '#lib/components/Rich.svelte';

	const KINDS = { bug: m.comentario_bug, sugestao: m.comentario_sugestao, outro: m.comentario_outro };
	let kind = $state<keyof typeof KINDS>('bug');
	let text = $state('');
	let withDevice = $state(true);
	let busy = $state(false);
	let error = $state('');

	// dados que ajudam a reproduzir um problema; a pessoa vê e decide se manda
	const device = $derived(
		[
			m.comentario_navegador({ navegador: navigator.userAgent }),
			m.comentario_tela({ tela: `${screen.width}×${screen.height}`, janela: `${innerWidth}×${innerHeight}` }),
			m.comentario_instalado({ resposta: matchMedia('(display-mode: standalone)').matches ? m.comum_sim() : m.comum_nao() }),
			m.comentario_versao({ versao: __APP_RELEASE__, build: version }),
			m.comentario_conectados({ count: session.connectedRelays().length })
		].join('\n')
	);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = '';
		const body = `[${KINDS[kind]()}] ${text.trim()}${withDevice ? `\n\n${m.comentario_dados_titulo()}\n${device}` : ''}`;
		try {
			const key = await session.sendFeedback(FEEDBACK_INVITE, m.comentario_contato(), body);
			await goto(resolve('/conversa/[chave]', { chave: key }));
		} catch (err) {
			error = friendlyError(err);
			busy = false;
		}
	}
</script>

<svelte:head><title>{m.titulo_pagina({ pagina: m.comentario_titulo() })}</title></svelte:head>

<main>
	<BackLink href={resolve('/ajustes')} label={m.inicio_ajustes()} />
	<h1>{m.comentario_titulo()}</h1>
	{#if !FEEDBACK_INVITE}
		<p class="hint">{m.comentario_nao_configurado()}</p>
	{:else}
		<p><Rich text={m.comentario_explicacao({ nome: m.comentario_contato() })} /></p>
		<form onsubmit={submit}>
			<fieldset>
				<legend>{m.comentario_tipo()}</legend>
				{#each Object.entries(KINDS) as [k, label] (k)}
					<label class="option"><input type="radio" name="tipo" value={k} bind:group={kind} /> {label()}</label>
				{/each}
			</fieldset>
			<label for="texto">{m.comentario_texto_rotulo()}</label>
			<textarea id="texto" rows="6" required maxlength="3000" bind:value={text}></textarea>
			<p class="hint">{m.comentario_texto_dica()}</p>
			<label class="option"><input type="checkbox" bind:checked={withDevice} /> {m.comentario_incluir_dados()}</label>
			{#if withDevice}<pre class="hint device">{device}</pre>{/if}
			{#if error}<p class="error" role="alert">{error}</p>{/if}
			<div class="actions">
				<button class="primary" type="submit" disabled={busy || !text.trim()}>{busy ? m.comentario_enviando() : m.envio_enviar()}</button>
			</div>
		</form>
	{/if}
	{#if FEEDBACK_FORM_URL}
		<p class="hint"><Rich text={m.comentario_formulario()} href={FEEDBACK_FORM_URL} external /></p>
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
