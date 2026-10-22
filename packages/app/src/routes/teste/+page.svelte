<script lang="ts">
	import BackLink from '#lib/components/BackLink.svelte';
	import { resolve } from '$app/paths';
	import Icon from '#lib/components/Icon.svelte';
	import { FEEDBACK_FORM_URL, FEEDBACK_INVITE } from '#lib/teste.ts';
</script>

<svelte:head><title>Como testar · Lero-lero</title></svelte:head>

<main class="page">
	<BackLink href={resolve('/')} label="Abrir o app" />
	<h1>Como testar o Lero-lero</h1>
	<p>
		Obrigado por testar o Lero-lero, um app de mensagens privadas que não pede telefone nem e-mail. Esta é uma
		versão de teste: ela já troca mensagens de texto, mas ainda falta muita coisa.
	</p>

	<h2>Antes de começar</h2>
	<p>Você vai precisar de um celular com internet e de 10 minutos. O app abre no navegador, sem loja de aplicativos.</p>
	<table>
		<thead><tr><th>Celular</th><th>Navegador</th><th>Instalar na tela de início</th></tr></thead>
		<tbody>
			<tr>
				<td>Android</td>
				<td>Chrome</td>
				<td>Recomendado: menu ⋮ → <strong>Instalar app</strong> (ou <strong>Adicionar à tela inicial</strong>)</td>
			</tr>
			<tr>
				<td>iPhone</td>
				<td>Safari</td>
				<td>
					<strong>Obrigatório:</strong> botão Compartilhar → <strong>Adicionar à Tela de Início</strong>. Sem
					isso, o iPhone pode apagar sua conta depois de alguns dias sem uso
				</td>
			</tr>
		</tbody>
	</table>
	<p>Depois de instalar, abra sempre pelo ícone na tela de início.</p>

	<h2>Passo a passo</h2>
	<p>Sua conta fica só no seu celular, protegida por um PIN. Uma frase de 12 palavras é a única forma de recuperá-la.</p>
	<ol>
		<li>
			<strong>Crie a conta.</strong> Toque em <strong>Criar minha conta</strong>, escreva seu nome (só seus contatos
			vão ver) e crie um PIN de 6 números.
		</li>
		<li>
			<strong>Guarde a frase de 12 palavras.</strong> Anote num papel guardado em casa, ou salve num gerenciador de
			senhas. Depois o app pede duas palavras para conferir.
			<ul>
				<li>Sem a frase, perder o celular ou esquecer o PIN significa perder a conta. Ninguém consegue recuperar para você.</li>
				<li>Nunca mande a frase para ninguém, nem para quem te convidou.</li>
			</ul>
		</li>
		<li>
			<strong>Adicione quem te convidou.</strong> Toque no link de convite que você recebeu, ou vá em
			<strong>Ver contatos → Adicionar contato</strong> e leia o QR code da pessoa com a câmera.
		</li>
		<li>
			<strong>Mande seu convite</strong>, se quiser falar com mais alguém do teste: <strong>Convidar alguém</strong>,
			e depois mostre o QR ou compartilhe o link.
		</li>
		<li>
			<strong>Converse.</strong> Abra o contato e toque em <strong>Conversar</strong>. Cada mensagem mostra
			<span class="inline-icon"><Icon name="clock" size={14} /></span> enquanto sai e
			<span class="inline-icon"><Icon name="check" size={14} /></span> quando chegou ao servidor.
		</li>
	</ol>
	<p>O app pede o PIN sempre que é aberto. Esqueceu o PIN? Use <strong>Esqueci o PIN</strong> e digite a frase.</p>

	<h2>O que ainda não funciona</h2>
	<p>Esta versão só troca <strong>texto, entre duas pessoas</strong>. O resto vem nas próximas versões.</p>
	<table>
		<thead><tr><th>Limitação</th><th>O que isso significa para você</th></tr></thead>
		<tbody>
			<tr><td>Sem notificações</td><td>Abra o app de vez em quando para ver se chegou mensagem</td></tr>
			<tr><td>Sem fotos, áudios ou grupos</td><td>Só texto, de pessoa para pessoa</td></tr>
			<tr><td>Sem "entregue" e "lida"</td><td>O ✓ diz só que a mensagem chegou ao servidor, não ao celular da outra pessoa</td></tr>
			<tr><td>Sem bloqueio e sem filtro de spam</td><td>Quem tiver seu link de convite consegue te mandar mensagem</td></tr>
			<tr><td>Sem backup dos contatos</td><td>Se trocar de celular, a frase recupera a conta, mas os contatos precisam ser adicionados de novo</td></tr>
			<tr><td>Servidores no exterior</td><td>Alguma mensagem pode atrasar ou se perder; se notar, conte pra gente</td></tr>
		</tbody>
	</table>
	<p><strong>Cuidados durante o teste:</strong></p>
	<ul>
		<li>Não publique seu link de convite em grupos ou redes sociais: mande só para quem está no teste.</li>
		<li>Não use para assuntos sensíveis. O app ainda não passou por auditoria de segurança.</li>
		<li>Os links de convite e até as contas podem precisar ser refeitos antes da versão final. Avisaremos.</li>
	</ul>

	<h2>Como dar retorno</h2>
	<p>Conte o que estranhou, mesmo que pareça bobagem: é isso que o teste quer descobrir.</p>
	<ul>
		{#if FEEDBACK_INVITE}
			<li>
				<strong>Pelo app:</strong> <strong>Ajustes → Enviar comentário</strong>. Chega cifrado para a equipe, e a
				resposta aparece como uma conversa.
			</li>
		{/if}
		{#if FEEDBACK_FORM_URL}
			<li>
				<strong>Pelo <a href={FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer">formulário</a>:</strong>
				para mandar prints, ou se o app não estiver funcionando.
			</li>
		{/if}
		{#if !FEEDBACK_INVITE && !FEEDBACK_FORM_URL}
			<li>Fale direto com quem te convidou.</li>
		{/if}
	</ul>
	<p>Ajuda muito saber:</p>
	<ul>
		<li><strong>Onde travou ou ficou confuso</strong>, e o que você esperava que acontecesse.</li>
		<li><strong>A frase de 12 palavras:</strong> entendeu para que serve? Onde guardou?</li>
		<li><strong>O convite:</strong> conseguiu adicionar a pessoa? Pelo QR ou pelo link?</li>
		<li><strong>Mensagens:</strong> alguma não chegou, chegou repetida ou demorou muito? Diga mais ou menos o dia e a hora.</li>
		<li><strong>Seu celular:</strong> modelo, e se é Android ou iPhone.</li>
	</ul>
	<p>Um print da tela ajuda, desde que não mostre a frase de 12 palavras.</p>

	<p class="hint">Vai fazer o teste completo de dois dias? Siga o <a href={resolve('/teste/roteiro')}>roteiro de aceite</a>.</p>
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
	.inline-icon {
		display: inline-block;
		vertical-align: -2px;
	}
</style>
