<script lang="ts">
	import BackLink from '#lib/components/BackLink.svelte';
	import { resolve } from '$app/paths';
	import Rich from '#lib/components/Rich.svelte';
	import { iconMark } from '#lib/i18n.svelte.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { FEEDBACK_FORM_URL, FEEDBACK_INVITE } from '#lib/teste.ts';

	const limits = [
		[m.guia_lim_notificacoes, m.guia_lim_notificacoes_texto],
		[m.guia_lim_fotos, m.guia_lim_fotos_texto],
		[m.guia_lim_apagar, m.guia_lim_apagar_texto],
		[m.guia_lim_status, m.guia_lim_status_texto],
		[m.guia_lim_spam, m.guia_lim_spam_texto],
		[m.guia_lim_backup, m.guia_lim_backup_texto],
		[m.guia_lim_servidores, m.guia_lim_servidores_texto]
	];
</script>

<svelte:head><title>{m.titulo_pagina({ pagina: m.guia_titulo_pagina() })}</title></svelte:head>

<main class="page">
	<BackLink href={resolve('/')} label={m.guia_abrir_app()} />
	<h1>{m.guia_titulo()}</h1>
	<p>{m.guia_intro()}</p>

	<h2>{m.guia_antes_titulo()}</h2>
	<p>{m.guia_antes_texto()}</p>
	<table>
		<thead><tr><th>{m.guia_col_celular()}</th><th>{m.guia_col_navegador()}</th><th>{m.guia_col_instalar()}</th></tr></thead>
		<tbody>
			<tr>
				<td>{m.guia_android()}</td>
				<td>{m.guia_chrome()}</td>
				<td><Rich text={m.guia_android_instalar()} /></td>
			</tr>
			<tr>
				<td>{m.guia_iphone()}</td>
				<td>{m.guia_safari()}</td>
				<td><Rich text={m.guia_iphone_instalar()} /></td>
			</tr>
		</tbody>
	</table>
	<p>{m.guia_abrir_icone()}</p>

	<h2>{m.guia_passos_titulo()}</h2>
	<p>{m.guia_passos_intro()}</p>
	<ol>
		<li><Rich text={m.guia_passo_conta()} /></li>
		<li><Rich text={m.guia_passo_adicionar()} /></li>
		<li>
			<Rich text={m.guia_passo_frase()} />
			<ul>
				<li>{m.guia_passo_frase_perder()}</li>
				<li>{m.guia_passo_frase_nunca()}</li>
			</ul>
		</li>
		<li><Rich text={m.guia_passo_convite()} /></li>
		<li><Rich text={m.guia_passo_conversar({ relogio: iconMark('clock'), check: iconMark('check') })} /></li>
		<li><Rich text={m.guia_passo_audio({ microfone: iconMark('mic'), enviar: iconMark('send') })} /></li>
		<li><Rich text={m.guia_passo_grupo()} /></li>
		<li><Rich text={m.guia_passo_apagar()} /></li>
	</ol>
	<p><Rich text={m.guia_pin()} /></p>

	<h2>{m.guia_falta_titulo()}</h2>
	<p><Rich text={m.guia_falta_intro()} /></p>
	<table>
		<thead><tr><th>{m.guia_col_limitacao()}</th><th>{m.guia_col_significa()}</th></tr></thead>
		<tbody>
			{#each limits as [limit, meaning], i (i)}
				<tr><td>{limit()}</td><td><Rich text={meaning()} /></td></tr>
			{/each}
		</tbody>
	</table>
	<p><strong>{m.guia_cuidados()}</strong></p>
	<ul>
		<li>{m.guia_cuidado_link()}</li>
		<li>{m.guia_cuidado_sensivel()}</li>
		<li>{m.guia_cuidado_refazer()}</li>
	</ul>

	<h2>{m.guia_retorno_titulo()}</h2>
	<p>{m.guia_retorno_intro()}</p>
	<ul>
		{#if FEEDBACK_INVITE}
			<li><Rich text={m.guia_retorno_app()} /></li>
		{/if}
		{#if FEEDBACK_FORM_URL}
			<li><Rich text={m.guia_retorno_formulario()} href={FEEDBACK_FORM_URL} external /></li>
		{/if}
		{#if !FEEDBACK_INVITE && !FEEDBACK_FORM_URL}
			<li>{m.guia_retorno_direto()}</li>
		{/if}
	</ul>
	<p>{m.guia_ajuda()}</p>
	<ul>
		<li><Rich text={m.guia_ajuda_travou()} /></li>
		<li><Rich text={m.guia_ajuda_frase()} /></li>
		<li><Rich text={m.guia_ajuda_convite()} /></li>
		<li><Rich text={m.guia_ajuda_mensagens()} /></li>
		<li><Rich text={m.guia_ajuda_audios()} /></li>
		<li><Rich text={m.guia_ajuda_celular()} /></li>
	</ul>
	<p>{m.guia_print()}</p>

	<p class="hint"><Rich text={m.guia_roteiro()} href={resolve('/teste/roteiro')} /></p>
</main>

<style>
	.page {
		max-width: 720px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		margin: 0.6rem 0 1rem;
		font-size: 0.95rem;
	}
	th,
	td {
		text-align: left;
		vertical-align: top;
		padding: 0.5rem 0.6rem 0.5rem 0;
		border-bottom: 1px solid var(--line);
	}
	th {
		color: var(--muted);
		font-weight: 600;
	}
	li {
		margin-bottom: 0.4rem;
	}
	h2 {
		margin-top: 2rem;
	}
</style>
