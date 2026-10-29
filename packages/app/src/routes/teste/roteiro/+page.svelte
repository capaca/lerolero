<script lang="ts">
	import BackLink from '#lib/components/BackLink.svelte';
	import { resolve } from '$app/paths';
	import Rich from '#lib/components/Rich.svelte';
	import { m } from '#lib/paraglide/messages.js';

	// Critério de aceite do M1 (passos 1 a 15) e extras do M3 (16 a 23); docs/07-roadmap.md
	const steps = [
		[m.roteiro_passo_1, m.roteiro_esperado_1],
		[m.roteiro_passo_2, m.roteiro_esperado_2],
		[m.roteiro_passo_3, m.roteiro_esperado_3],
		[m.roteiro_passo_4, m.roteiro_esperado_4],
		[m.roteiro_passo_5, m.roteiro_esperado_5],
		[m.roteiro_passo_6, m.roteiro_esperado_6],
		[m.roteiro_passo_7, m.roteiro_esperado_7],
		[m.roteiro_passo_8, m.roteiro_esperado_8],
		[m.roteiro_passo_9, m.roteiro_esperado_9],
		[m.roteiro_passo_10, m.roteiro_esperado_10],
		[m.roteiro_passo_11, m.roteiro_esperado_11],
		[m.roteiro_passo_12, m.roteiro_esperado_12],
		[m.roteiro_passo_13, m.roteiro_esperado_13],
		[m.roteiro_passo_14, m.roteiro_esperado_14],
		[m.roteiro_passo_15, m.roteiro_esperado_15],
		[m.roteiro_passo_16, m.roteiro_esperado_16],
		[m.roteiro_passo_17, m.roteiro_esperado_17],
		[m.roteiro_passo_18, m.roteiro_esperado_18],
		[m.roteiro_passo_19, m.roteiro_esperado_19],
		[m.roteiro_passo_20, m.roteiro_esperado_20],
		[m.roteiro_passo_21, m.roteiro_esperado_21],
		[m.roteiro_passo_22, m.roteiro_esperado_22],
		[m.roteiro_passo_23, m.roteiro_esperado_23]
	];
</script>

<svelte:head><title>{m.titulo_pagina({ pagina: m.roteiro_titulo() })}</title></svelte:head>

<main class="page">
	<BackLink href={resolve('/teste')} label={m.guia_titulo_pagina()} />
	<h1>{m.roteiro_titulo()}</h1>
	<p>{m.roteiro_intro()}</p>

	<h2>{m.roteiro_preparo_titulo()}</h2>
	<p><Rich text={m.roteiro_preparo_texto()} /></p>
	<table>
		<thead><tr><th>{m.roteiro_col_quem()}</th><th>{m.roteiro_col_aparelho()}</th><th>{m.roteiro_col_uso()}</th></tr></thead>
		<tbody>
			<tr><td>A</td><td>{m.roteiro_celular_a()}</td><td>{m.roteiro_celular_a_uso()}</td></tr>
			<tr><td>B</td><td>{m.roteiro_celular_b()}</td><td>{m.roteiro_celular_b_uso()}</td></tr>
			<tr><td>A</td><td>{m.roteiro_aparelho_novo()}</td><td>{m.roteiro_aparelho_novo_uso()}</td></tr>
		</tbody>
	</table>
	<ul>
		<li><Rich text={m.roteiro_leiam()} href={resolve('/teste')} /></li>
		<li><Rich text={m.roteiro_versao()} /></li>
		<li>{m.roteiro_iphone()}</li>
		<li>{m.roteiro_frase()}</li>
	</ul>

	<h2>{m.roteiro_titulo_passos()}</h2>
	<p>{m.roteiro_passos_intro()}</p>
	<table>
		<thead><tr><th>{m.roteiro_col_numero()}</th><th>{m.roteiro_col_passo()}</th><th>{m.roteiro_col_esperado()}</th></tr></thead>
		<tbody>
			{#each steps as [step, expected], i (i)}
				<tr><td>{i + 1}</td><td>{step()}</td><td>{expected()}</td></tr>
			{/each}
		</tbody>
	</table>
	<p class="hint">{m.roteiro_servidores()}</p>

	<h2>{m.roteiro_falha_titulo()}</h2>
	<p><Rich text={m.roteiro_falha_intro()} /></p>
	<ul>
		<li>{m.roteiro_falha_passo()}</li>
		<li>{m.roteiro_falha_celular()}</li>
		<li>{m.roteiro_falha_hora()}</li>
		<li><Rich text={m.roteiro_falha_servidores()} /></li>
		<li>{m.roteiro_falha_print()}</li>
	</ul>
	<p>{m.roteiro_falha_importante()}</p>
</main>

<style>
	.page {
		max-width: 760px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		margin: 0.6rem 0 1rem;
		font-size: 0.92rem;
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
	td:first-child {
		color: var(--muted);
		width: 2rem;
	}
	li {
		margin-bottom: 0.4rem;
	}
	h2 {
		margin-top: 2rem;
	}
</style>
