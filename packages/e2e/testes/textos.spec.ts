// Textos fora do código (RNF-71, ADR-0008): o app montado com a pseudolíngua, em que todo texto traduzido
// aparece "[Àššîɱ···]". Texto sem colchetes na tela ficou fixo no código e não seria traduzido.
// As telas entram aqui à medida que os textos delas saem do código.
import type { Page } from '@playwright/test';
import {
	abrirPedido,
	adicionarPeloConvite,
	adicionarUmAoOutro,
	digitarPin,
	enviarAudio,
	enviarTexto,
	expect,
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
		while (nos.nextNode()) if (fixo(nos.currentNode.textContent)) achados.push(nos.currentNode.textContent!.trim());
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
	await ana.page.keyboard.press('Escape');
	await ana.page.locator('.composer button.round').click();
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
