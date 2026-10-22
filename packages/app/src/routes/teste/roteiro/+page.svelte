<script lang="ts">
	import BackLink from '#lib/components/BackLink.svelte';
	import { resolve } from '$app/paths';

	// Passos do critério de aceite do M1 (docs/07-roadmap.md)
	const steps = [
		['A e B criam a conta: nome, PIN, frase e conferir 2 palavras', 'Chegam à tela de conversas, sem lembrete da frase'],
		['B lê o QR de A (A em + → Convidar alguém; B em + → Adicionar contato → Abrir a câmera)', 'B vê "Se apresenta como" com o nome de A; depois de Adicionar, A está nos contatos de B'],
		['B abre A, toca em Conversar e envia "oi"', 'A mensagem aparece na hora com o relógio, que vira ✓ em até 2 s'],
		['A abre o app', 'A conversa com B está na lista, com o nome de B e 1 não lida; ao abrir, aviso "não está nos seus contatos" e Adicionar aos contatos funciona'],
		['A e B trocam 5 mensagens com a conversa aberta', 'Cada uma chega sem recarregar, em poucos segundos, na ordem e sem repetir'],
		['B põe o celular em modo avião e fecha o app até o dia seguinte', '—'],
		['Ao longo do dia, A envia 3 mensagens para B', 'As 3 ficam com ✓ para A'],
		['Dia 2: B sai do modo avião e abre o app', 'As 3 mensagens de A aparecem uma vez cada, na ordem, com 3 não lidas'],
		['B responde', 'A recebe'],
		['A restaura no aparelho novo: Já tenho uma conta, frase, nome e PIN', 'Entra; em Ajustes, a chave (npub) é a mesma do celular de A'],
		['No aparelho novo, A abre a lista de conversas', 'A conversa com B volta com as mensagens dos últimos dias; B aparece como "não está nos seus contatos" (esperado: ainda não há backup de contatos)'],
		['A envia do aparelho novo para B', 'B recebe; no celular antigo de A, a mesma mensagem aparece como enviada (✓)'],
		['Extra: A erra o PIN 6 vezes', 'Aviso para esperar 30 s; nem o PIN certo entra antes disso'],
		['Extra: Esqueci o PIN, com a frase', 'O PIN novo funciona e as conversas continuam lá']
	];
</script>

<svelte:head><title>Roteiro de aceite · Lero-lero</title></svelte:head>

<main class="page">
	<BackLink href={resolve('/teste')} label="Como testar" />
	<h1>Roteiro de aceite</h1>
	<p>
		Esta versão está aprovada quando duas pessoas, em celulares diferentes, criam a conta, se adicionam por QR e
		trocam mensagens, inclusive com uma delas offline por um dia, e restaurar a conta num aparelho novo funciona.
	</p>

	<h2>Preparo</h2>
	<p>São duas pessoas e três aparelhos, ao longo de dois dias. Chamamos de <strong>A</strong> e <strong>B</strong> as duas pessoas.</p>
	<table>
		<thead><tr><th>Quem</th><th>Aparelho</th><th>Uso</th></tr></thead>
		<tbody>
			<tr><td>A</td><td>Celular de A</td><td>Cadastro, conversa e restauração</td></tr>
			<tr><td>B</td><td>Celular de B</td><td>Fica offline por um dia</td></tr>
			<tr><td>A</td><td>Um "aparelho novo": outro celular, ou o computador numa janela anônima</td><td>Restaurar a conta de A pela frase</td></tr>
		</tbody>
	</table>
	<ul>
		<li>Leiam antes o guia <a href={resolve('/teste')}>Como testar</a>.</li>
		<li>Se a tela inicial não tiver o quadro <strong>Conversas</strong>, fechem e abram de novo: o app guarda a versão anterior por uma abertura.</li>
		<li>No iPhone, instalem na tela de início antes de criar a conta.</li>
		<li>A pessoa A precisa da frase de 12 palavras para o passo de restauração: guarde-a no cadastro.</li>
	</ul>

	<h2>Roteiro</h2>
	<p>Sigam na ordem e anotem o resultado de cada passo (passou, parcial ou falhou). O passo 6 começa o dia offline de B; o dia 2 começa no passo 8.</p>
	<table>
		<thead><tr><th>#</th><th>Passo</th><th>Resultado esperado</th></tr></thead>
		<tbody>
			{#each steps as [step, expected], i (i)}
				<tr><td>{i + 1}</td><td>{step}</td><td>{expected}</td></tr>
			{/each}
		</tbody>
	</table>
	<p class="hint">O passo 11 depende de os servidores guardarem as mensagens pelo tempo do teste.</p>

	<h2>Se algo falhar</h2>
	<p>Mande pelo app (<strong>Ajustes → Enviar comentário</strong>) ou pelo formulário indicado no guia. Para conseguirmos reproduzir, conte:</p>
	<ul>
		<li>O número do passo, o que apareceu na tela e o que você esperava.</li>
		<li>Celular, sistema (Android ou iPhone) e navegador.</li>
		<li>Dia e hora aproximados, principalmente se uma mensagem não chegou ou chegou atrasada.</li>
		<li>Em <strong>Ajustes → Servidores</strong>: quantos estavam conectados naquele momento.</li>
		<li>Um print da tela, desde que não mostre a frase de 12 palavras.</li>
	</ul>
	<p>Uma falha nos passos 5, 8 ou 12 (mensagem que não chega) é a mais importante: avise mesmo que o resto tenha passado.</p>
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
