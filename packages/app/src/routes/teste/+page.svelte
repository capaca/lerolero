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
		versão de teste: ela já troca mensagens de texto e áudio, inclusive em grupo, mas ainda falta muita coisa.
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
			<strong>Adicione quem te convidou.</strong> Toque no link de convite que você recebeu, ou vá em
			<strong>+ → Adicionar contato</strong> e leia o QR code da pessoa com a câmera.
		</li>
		<li>
			<strong>Guarde a frase de 12 palavras.</strong> Ao adicionar o primeiro contato, o app mostra a frase. Anote
			num papel guardado em casa, ou salve num gerenciador de senhas. Depois o app pede duas palavras para conferir.
			<ul>
				<li>Sem a frase, perder o celular ou esquecer o PIN significa perder a conta. Ninguém consegue recuperar para você.</li>
				<li>Nunca mande a frase para ninguém, nem para quem te convidou.</li>
			</ul>
		</li>
		<li>
			<strong>Mande seu convite</strong>, se quiser falar com mais alguém do teste: <strong>+ → Convidar alguém</strong>,
			e depois mostre o QR ou compartilhe o link.
		</li>
		<li>
			<strong>Converse.</strong> Toque na conversa, ou em <strong>+ → Conversar com um contato</strong>. Cada
			mensagem mostra <span class="inline-icon"><Icon name="clock" size={14} /></span> enquanto sai e
			<span class="inline-icon"><Icon name="check" size={14} /></span> quando chegou ao servidor.
		</li>
		<li>
			<strong>Mande um áudio.</strong> Com a caixa de texto vazia, toque no
			<span class="inline-icon"><Icon name="mic" size={14} /></span> para começar a gravar e toque em
			<span class="inline-icon"><Icon name="send" size={14} /></span> para enviar (até 5 minutos). Quem recebe pode
			ouvir em 1x, 1,5x ou 2x.
		</li>
		<li>
			<strong>Crie um grupo.</strong> Toque em <strong>+ → Novo grupo</strong>, dê um nome e escolha quem participa
			(até 20 pessoas, contando você). No grupo, quem não está nos seus contatos aparece com um <strong>~</strong>
			antes do nome que a própria pessoa escolheu. Toque no nome do grupo, no topo da conversa, para ver quem
			participa; quem administra adiciona e remove pessoas, muda o nome e escolhe outros administradores. Lá também
			dá para sair do grupo.
		</li>
		<li>
			<strong>Copie ou apague uma mensagem.</strong> Segure o dedo sobre ela (o celular vibra de leve) e escolha
			<strong>Copiar</strong>, <strong>Apagar para mim</strong> ou, nas suas mensagens, <strong>Apagar para todos</strong>.
		</li>
	</ol>
	<p>O app pede o PIN quando você abre depois de mais de 5 minutos fora dele. Esqueceu o PIN? Use <strong>Esqueci o PIN</strong> e digite a frase.</p>

	<h2>O que ainda não funciona</h2>
	<p>Esta versão troca <strong>texto e áudio</strong>, entre duas pessoas ou em grupo. O resto vem nas próximas versões.</p>
	<table>
		<thead><tr><th>Limitação</th><th>O que isso significa para você</th></tr></thead>
		<tbody>
			<tr><td>Sem notificações</td><td>Abra o app de vez em quando para ver se chegou mensagem</td></tr>
			<tr><td>Sem fotos e arquivos</td><td>Só texto e áudio</td></tr>
			<tr><td>"Apagar para todos" é um pedido</td><td>No Lero-lero a mensagem some para todos na conversa; se a outra pessoa usar outro app compatível, ele pode ignorar o pedido</td></tr>
			<tr><td>Sem "entregue" e "lida"</td><td>O ✓ diz só que a mensagem chegou ao servidor, não ao celular da outra pessoa</td></tr>
			<tr><td>Sem filtro contra spam em massa</td><td>Quem tiver seu link de convite consegue te mandar mensagem, mas a conversa chega em <strong>Contatos › Pedidos de mensagem</strong> (um ponto no ícone avisa), sem link nem áudio abertos até você aceitar, e dá para bloquear</td></tr>
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
				<strong>Pelo app:</strong> <strong>Ajustes</strong> (a engrenagem no topo) <strong>→ Enviar comentário</strong>. Chega cifrado para a equipe, e a
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
		<li><strong>Áudios:</strong> o som ficou claro? Algum não tocou ou demorou para carregar?</li>
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
