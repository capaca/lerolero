// Textos fora do código (RNF-71, ADR-0008): o app montado com a pseudolíngua, em que todo texto traduzido
// aparece "[Àššîɱ···]". Texto sem colchetes na tela ficou fixo no código e não seria traduzido.
// Cobre todas as telas: uma tela nova entra aqui junto com ela.
import type { Page } from '@playwright/test';
import {
	abrirPedido,
	adicionarPeloConvite,
	adicionarUmAoOutro,
	digitarPin,
	enviarAudio,
	enviarTexto,
	expect,
	meuConvite,
	PIN,
	test,
	vencerSessao
} from '../ajudantes.ts';
import { PSEUDO_URL } from '../servidores.ts';

/** Textos visíveis, rótulos e o título que ainda estão fixos; `permitidos` são dados da pessoa (o nome). */
function textosFixos(page: Page, permitidos: string[] = []) {
	return page.evaluate((permitidos) => {
		// tira os trechos traduzidos, de dentro para fora (um texto pode ir dentro de outro)
		const semTraducao = (texto: string) => {
			let antes;
			do {
				antes = texto;
				texto = texto.replace(/\[[^[\]]*\]/g, ' ');
			} while (texto !== antes);
			for (const p of permitidos) texto = texto.replaceAll(p, ' ');
			return texto;
		};
		const fixo = (texto: string | null) => !!texto && /\p{L}{2,}/u.test(semTraducao(texto));
		const achados: string[] = [];
		const nos = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
			acceptNode: (n) =>
				n.parentElement?.closest('script, style, [hidden]') || !n.parentElement?.checkVisibility()
					? NodeFilter.FILTER_REJECT
					: NodeFilter.FILTER_ACCEPT
		});
		// uma frase com negrito ou link no meio (`Rich`) chega em vários nós, com os colchetes em nós diferentes:
		// confere o texto inteiro do elemento que a contém
		const conferidos = new Set<Node>();
		while (nos.nextNode()) {
			if (!nos.currentNode.textContent!.trim()) continue; // espaço entre elementos levaria ao <main> inteiro
			const alvo = nos.currentNode.parentElement!.closest(':not(strong, b, em, a)') ?? nos.currentNode;
			if (conferidos.has(alvo)) continue;
			conferidos.add(alvo);
			// innerText: sem o conteúdo de <script> e do que está escondido
			const texto = alvo instanceof HTMLElement ? alvo.innerText : alvo.textContent;
			if (fixo(texto)) achados.push(texto!.trim());
		}
		for (const el of document.body.querySelectorAll('[aria-label], [placeholder], [title], [alt]')) {
			for (const atributo of ['aria-label', 'placeholder', 'title', 'alt']) {
				const valor = el.getAttribute(atributo);
				if (fixo(valor)) achados.push(`${atributo}="${valor}"`);
			}
		}
		if (fixo(document.title)) achados.push(`<title>${document.title}`);
		return achados;
	}, permitidos);
}

const semTextoFixo = async (page: Page, permitidos?: string[]) => expect(await textosFixos(page, permitidos)).toEqual([]);

/**
 * A mesma tela no build da pseudolíngua. Os dois builds têm a mesma origem e o mesmo banco: o que foi montado
 * pelo app normal (contas, contatos, mensagens), com os ajudantes de sempre, aparece igual no outro.
 */
const naPseudolingua = (page: Page) => page.goto(page.url().replace('/lerolero/', '/lerolero-pseudo/'));

/** Dados que aparecem como estão, sem tradução (chaves, endereços de servidores, as palavras da frase). */
const dados = async (page: Page, seletor: string) =>
	(await page.locator(seletor).allTextContents()).map((t) => t.replace(/^\d+/, '').trim()).filter(Boolean);

test('entrada (boas-vindas, cadastro, PIN, recuperar, esqueci o PIN): nenhum texto fixo', async ({ novoAparelho }) => {
	const page = await novoAparelho(PSEUDO_URL);
	await page.goto('./');
	await expect(page).toHaveURL(/\/bem-vindo$/);
	await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
	await semTextoFixo(page);

	// recuperar: palavra desconhecida, depois frase curta demais (erro que vem do worker com o código)
	await page.goto('./restaurar');
	await page.locator('#frase').fill('abacate xyzw ');
	await expect(page.locator('.hint .error')).toBeVisible();
	await semTextoFixo(page, ['abacate', 'xyzw']);
	await page.locator('#nome').fill('Maria');
	await digitarPin(page, 'pin', PIN);
	await page.keyboard.type(PIN);
	await page.locator('button[type="submit"]').click();
	await expect(page.getByRole('alert')).toBeVisible();
	await semTextoFixo(page, ['abacate', 'xyzw', 'Maria']);

	// cadastro: nome, PIN com os dois campos diferentes
	await page.goto('./cadastro');
	await semTextoFixo(page);
	await page.locator('#nome').fill('Maria');
	await page.locator('button[type="submit"]').click();
	await digitarPin(page, 'pin', PIN);
	await page.keyboard.type('654321');
	await expect(page.getByRole('alert')).toBeVisible();
	await semTextoFixo(page);
	await page.keyboard.type(PIN);
	await expect(page).toHaveURL(PSEUDO_URL);

	// desbloquear com PIN errado e "esqueci o PIN"
	await vencerSessao(page);
	await page.goto('./');
	await expect(page).toHaveURL(/\/desbloquear$/, { timeout: 20_000 });
	await digitarPin(page, 'pin', '000000');
	await expect(page.getByRole('alert')).not.toBeEmpty({ timeout: 20_000 });
	await semTextoFixo(page, ['Maria']);
	await page.locator('a.forgot').click();
	await expect(page).toHaveURL(/\/esqueci-pin$/);
	await semTextoFixo(page);
});

test('guia de teste e roteiro de aceite: nenhum texto fixo', async ({ novoAparelho }) => {
	const page = await novoAparelho(PSEUDO_URL);
	await page.goto('./teste');
	await expect(page.locator('h1')).toBeVisible();
	await semTextoFixo(page);
	await page.goto('./teste/roteiro');
	await expect(page.locator('tbody tr')).toHaveCount(23);
	await semTextoFixo(page);
});

test('conversa (lista, balões, menus, áudio, avisos de grupo e pedido): nenhum texto fixo', async ({ novaPessoa }) => {
	const [ana, bia, caio] = await Promise.all(['Ana', 'Bia', 'Caio'].map(novaPessoa));
	const nomes = ['Ana', 'Bia', 'Caio', 'Amigos', 'oi', 'apagar'];
	// montado no app normal: texto, áudio e uma mensagem apagada entre a Ana e a Bia; um grupo; um pedido do Caio
	await adicionarUmAoOutro(ana, bia);
	await enviarTexto(bia.page, 'oi');
	await enviarAudio(bia.page, 1);
	await enviarTexto(bia.page, 'apagar');
	await bia.page.locator('.row.mine', { hasText: 'apagar' }).locator('.bubble').click({ button: 'right' });
	const menu = bia.page.getByRole('dialog', { name: 'Opções da mensagem' });
	await menu.getByRole('button', { name: 'Apagar para todos' }).click();
	await menu.getByRole('button', { name: 'Apagar para todos' }).click();
	await ana.page.goto('./grupo/novo');
	await ana.page.locator('#nome').fill('Amigos');
	await ana.page.locator('.person', { hasText: 'Bia' }).click();
	await ana.page.getByRole('button', { name: 'Criar grupo' }).click();
	await expect(ana.page.locator('.notice-line')).toBeVisible();
	await adicionarPeloConvite(ana, caio);
	await enviarTexto(caio.page, 'oi');

	// lista: prévias de aviso de grupo e de mensagem apagada, menu da conversa e "nova conversa"
	await ana.page.goto('./');
	await expect(ana.page.locator('.conversations a', { hasText: 'Bia' }).locator('.preview')).toHaveText('Mensagem apagada', { timeout: 20_000 });
	await naPseudolingua(ana.page);
	await expect(ana.page.locator('.conversations a')).toHaveCount(2);
	await semTextoFixo(ana.page, nomes);
	await ana.page.locator('.conversations a', { hasText: 'Amigos' }).click({ button: 'right' });
	await semTextoFixo(ana.page, nomes);
	await ana.page.keyboard.press('Escape');
	await ana.page.locator('.conversations a', { hasText: 'Bia' }).click({ button: 'right' });
	await semTextoFixo(ana.page, nomes);
	await ana.page.keyboard.press('Escape');
	await ana.page.locator('button.fab').click();
	await semTextoFixo(ana.page, nomes);
	await ana.page.keyboard.press('Escape');

	// conversa 1:1: texto, áudio, apagada, dia; menu da mensagem; gravando
	await ana.page.locator('.conversations a', { hasText: 'Bia' }).click();
	await expect(ana.page.locator('.player')).toBeVisible();
	await semTextoFixo(ana.page, nomes);
	await ana.page.locator('.row', { hasText: 'oi' }).locator('.bubble').click({ button: 'right' });
	await semTextoFixo(ana.page, nomes);
	// "Encaminhar" é o quarto item (depois de Responder, Favoritar e Copiar): abre a escolha do destino
	await ana.page.locator('.sheet .item').nth(3).click();
	await expect(ana.page.locator('.sheet .targets button')).not.toHaveCount(0);
	await semTextoFixo(ana.page, nomes);
	await ana.page.keyboard.press('Escape');

	// responder e reagir: a faixa de resposta, o balão com a citação e o chip da reação
	await ana.page.locator('.row', { hasText: 'oi' }).first().locator('.bubble').click({ button: 'right' });
	await ana.page.locator('.sheet .item').first().click();
	await expect(ana.page.locator('.composer .reply')).toBeVisible();
	await semTextoFixo(ana.page, nomes);
	await ana.page.locator('.composer textarea').fill('oi');
	await ana.page.locator('.composer button.round.primary').click();
	await expect(ana.page.locator('.row.mine .quote')).toBeVisible();
	await semTextoFixo(ana.page, nomes);
	await ana.page.locator('.row', { hasText: 'oi' }).first().locator('.bubble').click({ button: 'right' });
	await ana.page.locator('.sheet .emoji').first().click();
	await expect(ana.page.locator('.row .chip')).toBeVisible();
	await semTextoFixo(ana.page, nomes);

	await ana.page.locator('.composer button.round.primary').click();
	await expect(ana.page.locator('.composer .recording')).toBeVisible();
	await semTextoFixo(ana.page, nomes);
	await ana.page.locator('.composer .recording button').first().click();

	// grupo: o aviso e o subtítulo com "Você"
	await ana.page.goBack();
	await ana.page.locator('.conversations a', { hasText: 'Amigos' }).click();
	await expect(ana.page.locator('.notice-line')).toBeVisible();
	await semTextoFixo(ana.page, nomes);

	// pedido de mensagem do Caio, aberto por Contatos no app normal
	await abrirPedido(ana.page, 'Caio');
	await expect(ana.page).toHaveURL(/\/conversa\//);
	await naPseudolingua(ana.page);
	await expect(ana.page.locator('.banner.notice')).toBeVisible();
	await semTextoFixo(ana.page, nomes);
});

test('contatos, convite, frase, grupo e ajustes: nenhum texto fixo', async ({ novaPessoa }) => {
	const [ana, bia, caio, dani] = await Promise.all(['Ana', 'Bia', 'Caio', 'Dani'].map(novaPessoa));
	// "BS": as iniciais da Bia Silva no avatar
	const nomes = ['Bia Silva', 'BS', 'Ana', 'Bia', 'Caio', 'Dani', 'Amigos', 'oi'];
	const page = ana.page;
	const pseudo = (url: string) => url.replace('/lerolero/', '/lerolero-pseudo/');

	// convite da Bia aberto no app da Ana: é o primeiro contato, então vem "Guarde sua frase"
	await page.goto(pseudo(await meuConvite(bia.page)));
	await expect(page.locator('.card')).toBeVisible();
	await semTextoFixo(page, [...nomes, ...(await dados(page, '.key'))]);
	await page.locator('button[type="submit"]').click();
	await expect(page).toHaveURL(/\/guardar-frase/);
	await semTextoFixo(page);
	await page.locator('button.primary').click();
	await semTextoFixo(page);
	await digitarPin(page, 'pin', PIN);
	await expect(page.locator('ol li')).toHaveCount(12, { timeout: 20_000 });
	const palavras = await dados(page, 'ol li');
	await semTextoFixo(page, palavras);
	await page.locator('input[type="checkbox"]').check();
	await page.locator('button.primary').click();
	await page.locator('input[id^="palavra-"]').first().fill('errada');
	await page.locator('button[type="submit"]').click();
	await expect(page.getByRole('alert')).toBeVisible();
	await semTextoFixo(page);
	await page.locator('button.link').click(); // fazer depois

	// o contato: renomear e a pergunta de bloquear
	await expect(page).toHaveURL(/\/contatos\/[0-9a-f]{64}$/);
	await page.locator('#nome').fill('Bia Silva');
	await page.locator('form button[type="submit"]').click();
	await expect(page.getByRole('status')).toBeVisible();
	await semTextoFixo(page, [...nomes, ...(await dados(page, '.key'))]);
	await page.locator('main button.danger').click();
	await semTextoFixo(page, [...nomes, ...(await dados(page, '.key'))]);
	await page.keyboard.press('Escape');

	// o próprio convite aberto, e "Meu convite" com o link copiado
	await page.goto(pseudo(await meuConvite(page)));
	await expect(page.locator('.error')).toBeVisible();
	await semTextoFixo(page);
	await page.goto(PSEUDO_URL + 'contatos/meu-convite');
	await page.locator('.actions button:not(.primary)').click();
	await semTextoFixo(page);

	// adicionar contato: câmera aberta e link inválido
	await page.goto(PSEUDO_URL + 'contatos/ler');
	await semTextoFixo(page);
	await page.locator('button.primary').click();
	await expect(page.locator('video')).toBeVisible();
	await semTextoFixo(page);
	await page.locator('section').first().locator('button').click();
	await page.locator('#link').fill('xyz');
	await page.locator('form button[type="submit"]').click();
	await expect(page.getByRole('alert')).toBeVisible();
	await semTextoFixo(page);

	// a Dani vira contato (no app normal); o Caio escreve sem ser contato e depois é bloqueado
	await adicionarPeloConvite(dani, ana);
	await adicionarPeloConvite(ana, caio);
	await enviarTexto(caio.page, 'oi');
	await page.goto(PSEUDO_URL + 'contatos');
	await expect(page.locator('#painel-contatos .list a').first()).toBeVisible();
	await semTextoFixo(page, nomes); // aba Contatos
	await page.getByRole('tab').last().click();
	await expect(page.locator('#painel-pedidos .list a')).toHaveCount(1, { timeout: 20_000 });
	await semTextoFixo(page, nomes);
	await page.locator('#painel-pedidos .list a').click();
	await expect(page).toHaveURL(/\/conversa\//);
	await page.goto(page.url().replace('/conversa/', '/contatos/'));
	await page.locator('main button.danger').click();
	await page.getByRole('dialog').locator('button.danger').click();
	await expect(page.locator('main > .actions button')).toBeVisible(); // desbloquear
	await semTextoFixo(page, [...nomes, ...(await dados(page, '.key'))]);
	await page.goto(PSEUDO_URL + 'contatos?aba=pedidos');
	await expect(page.locator('#painel-pedidos section h2')).toHaveCount(1);
	await semTextoFixo(page, nomes);

	// grupo novo: os dois erros, depois criado com a Bia
	await page.goto(PSEUDO_URL + 'grupo/novo');
	await expect(page.locator('.person')).toHaveCount(2);
	await semTextoFixo(page, nomes);
	await page.locator('button[type="submit"]').click();
	await semTextoFixo(page, nomes);
	await page.locator('#nome').fill('Amigos');
	await page.locator('button[type="submit"]').click();
	await expect(page.getByRole('alert')).toBeVisible();
	await semTextoFixo(page, nomes);
	await page.locator('.person', { hasText: 'Bia' }).click();
	await page.locator('button[type="submit"]').click();
	await expect(page).toHaveURL(/\/grupo\/[0-9a-f]+$/, { timeout: 20_000 });

	// detalhes: renomear, menu de um membro, remover, sair
	await page.goto(page.url() + '/detalhes');
	await expect(page.locator('button.row')).toHaveCount(2);
	await semTextoFixo(page, nomes);
	await page.locator('h1 button.icon').click();
	await semTextoFixo(page, nomes);
	await page.locator('form.rename button[type="button"]').click();
	await page.locator('button.row:not([disabled])').click();
	await semTextoFixo(page, nomes);
	await page.locator('.item.remove').click();
	await semTextoFixo(page, nomes);
	await page.keyboard.press('Escape');
	await page.locator('button.leave').click();
	await semTextoFixo(page, nomes);
	await page.keyboard.press('Escape');

	// adicionar pessoas: a Dani
	await page.locator('a.add').click();
	await expect(page.locator('.person')).toHaveCount(1);
	await page.locator('.person').click();
	await semTextoFixo(page, nomes);

	// ajustes, a frase (conferida desta vez) e o comentário
	await page.goto(PSEUDO_URL + 'ajustes');
	await expect(page.locator('.relays li').first()).toBeVisible({ timeout: 20_000 });
	await semTextoFixo(page, [...nomes, ...(await dados(page, '.key')), ...(await dados(page, '.relays li'))]);
	await page.goto(PSEUDO_URL + 'ajustes/frase');
	await semTextoFixo(page);
	await digitarPin(page, 'pin', PIN);
	await expect(page.locator('ol li')).toHaveCount(12, { timeout: 20_000 });
	await page.locator('.actions button.primary').click();
	for (const campo of await page.locator('input[id^="palavra-"]').all()) {
		await campo.fill(palavras[Number((await campo.getAttribute('id'))!.slice('palavra-'.length))]!);
	}
	await page.locator('button[type="submit"]').click();
	await expect(page.getByRole('status')).toBeVisible();
	await semTextoFixo(page, palavras);
	await page.goto(PSEUDO_URL + 'favoritas');
	await expect(page.locator('main .hint')).toBeVisible();
	await semTextoFixo(page);
	await page.goto(PSEUDO_URL + 'ajustes/comentario');
	await expect(page.locator('pre.device')).toBeVisible();
	await semTextoFixo(page);
});
