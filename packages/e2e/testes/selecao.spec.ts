// Seleção de várias mensagens (RF-28): favoritar, copiar, encaminhar e apagar de uma vez; os favoritos ficam em
// Ajustes › Mensagens favoritas.
import { abrirConversa, abrirConversaQuandoChegar, adicionarUmAoOutro, enviarTexto, expect, test, type Pessoa } from '../ajudantes.ts';

const menu = (p: Pessoa) => p.page.getByRole('dialog', { name: 'Opções da mensagem' });
const linha = (p: Pessoa, texto: string) => p.page.locator('.row', { hasText: texto });

async function selecionar(p: Pessoa, primeira: string, ...outras: string[]) {
	await linha(p, primeira).locator('.bubble').click({ button: 'right' });
	await menu(p).getByRole('button', { name: 'Selecionar' }).click();
	for (const texto of outras) await linha(p, texto).locator('.bubble').click();
}

test('favoritar, copiar e encaminhar várias; favoritas listadas em Ajustes', async ({ novaPessoa }) => {
	const [maria, joao, ana] = await Promise.all([novaPessoa('Maria'), novaPessoa('João'), novaPessoa('Ana')]);
	await adicionarUmAoOutro(maria, joao);
	for (const texto of ['primeira', 'segunda', 'terceira']) await enviarTexto(joao.page, texto);
	await abrirConversaQuandoChegar(maria.page, 'João');
	await expect(linha(maria, 'terceira')).toBeVisible({ timeout: 30_000 });

	// seleciona duas: a barra conta e a terceira fica de fora
	await selecionar(maria, 'primeira', 'segunda');
	await expect(maria.page.getByRole('toolbar', { name: '2 selecionadas' })).toBeVisible();
	await expect(maria.page.locator('.row[role="checkbox"][aria-checked="true"]')).toHaveCount(2);

	// copiar: várias vão com hora e nome
	await maria.page.getByRole('button', { name: 'Copiar', exact: true }).click();
	expect(await maria.page.evaluate(() => navigator.clipboard.readText())).toMatch(/^\[\d{2}:\d{2}\] João: primeira\n\[\d{2}:\d{2}\] João: segunda$/);
	await expect(maria.page.getByRole('toolbar')).toHaveCount(0);

	// favoritar as duas; a estrela aparece nos balões
	await selecionar(maria, 'primeira', 'segunda');
	await maria.page.getByRole('button', { name: 'Favoritar', exact: true }).click();
	await expect(maria.page.locator('.row .star')).toHaveCount(2);
	// a tela Favoritas fica no menu ⋮ da tela inicial
	await maria.page.goto('./');
	await maria.page.getByRole('button', { name: 'Mais opções' }).click();
	await maria.page.getByRole('dialog', { name: 'Mais opções' }).getByRole('link', { name: 'Favoritas' }).click();
	await expect(maria.page.locator('.starred li')).toHaveCount(2);
	await expect(maria.page.locator('.starred li').first()).toContainText('João');

	// o detalhe do contato mostra só as favoritas daquela conversa; o toque abre a conversa na mensagem
	await abrirConversa(maria.page, 'João');
	await maria.page.getByRole('link', { name: /^João/ }).first().click();
	await expect(maria.page.locator('.starred li')).toHaveCount(2);
	await maria.page.locator('.starred li', { hasText: 'segunda' }).locator('a').click();
	await expect(linha(maria, 'segunda')).toBeVisible();
	await expect(maria.page.locator('.row.flash')).toContainText('segunda');

	// tirar dos favoritos pelo menu de uma mensagem
	await linha(maria, 'segunda').locator('.bubble').click({ button: 'right' });
	await menu(maria).getByRole('button', { name: 'Tirar dos favoritos' }).click();
	await expect(maria.page.locator('.row .star')).toHaveCount(1);

	// encaminhar duas para a Ana
	await adicionarUmAoOutro(ana, maria);
	await abrirConversa(maria.page, 'João');
	await selecionar(maria, 'primeira', 'terceira');
	await maria.page.getByRole('button', { name: 'Encaminhar', exact: true }).click();
	await maria.page.getByRole('dialog', { name: 'Encaminhar para…' }).getByRole('button', { name: 'Ana' }).click();
	await expect(maria.page.getByRole('status')).toHaveText('2 mensagens encaminhadas');
	await expect(maria.page.getByRole('toolbar')).toHaveCount(0);
	await abrirConversaQuandoChegar(ana.page, 'Maria');
	await expect(linha(ana, 'primeira')).toBeVisible({ timeout: 30_000 });
	await expect(linha(ana, 'terceira')).toBeVisible({ timeout: 30_000 });
	await expect(linha(ana, 'segunda')).toHaveCount(0);
});

test('apagar várias: para mim some só aqui; para todos só vale nas minhas', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await adicionarUmAoOutro(maria, joao);
	for (const texto of ['um', 'dois', 'tres']) await enviarTexto(joao.page, `msg ${texto}`);
	await abrirConversaQuandoChegar(maria.page, 'João');
	await expect(linha(maria, 'msg tres')).toBeVisible({ timeout: 30_000 });

	// Maria: mensagens dos outros só se apagam para ela
	await selecionar(maria, 'msg um', 'msg dois');
	await maria.page.getByRole('button', { name: 'Apagar', exact: true }).click();
	const folha = maria.page.getByRole('dialog', { name: 'Apagar' });
	await expect(folha).toContainText('Apagar 2 mensagens?');
	await expect(folha.getByRole('button', { name: 'Apagar para todos' })).toHaveCount(0);
	await folha.getByRole('button', { name: 'Apagar para mim' }).click();
	await expect(linha(maria, 'msg um')).toHaveCount(0);
	await expect(linha(maria, 'msg dois')).toHaveCount(0);
	await expect(linha(maria, 'msg tres')).toBeVisible();
	await expect(linha(joao, 'msg um')).toBeVisible(); // o João continua com as dele

	// João: as dele podem ir para todos
	await selecionar(joao, 'msg dois', 'msg tres');
	await joao.page.getByRole('button', { name: 'Apagar', exact: true }).click();
	await joao.page.getByRole('dialog', { name: 'Apagar' }).getByRole('button', { name: 'Apagar para todos' }).click();
	await expect(joao.page.getByText('Você apagou esta mensagem')).toHaveCount(2);
	await expect(maria.page.getByText('Esta mensagem foi apagada')).toHaveCount(1, { timeout: 30_000 });
});

test('no grupo, os detalhes listam as favoritas com o nome de quem escreveu', async ({ novaPessoa }) => {
	const [ana, bia] = await Promise.all([novaPessoa('Ana'), novaPessoa('Bia')]);
	await adicionarUmAoOutro(bia, ana);
	await ana.page.goto('./grupo/novo');
	await ana.page.locator('#nome').fill('Amigos');
	await ana.page.locator('.person', { hasText: 'Bia' }).click();
	await ana.page.getByRole('button', { name: 'Criar grupo' }).click();
	await expect(ana.page.locator('.notice-line')).toBeVisible();

	await enviarTexto(ana.page, 'ideia do churrasco');
	await linha(ana, 'ideia do churrasco').locator('.bubble').click({ button: 'right' });
	await menu(ana).getByRole('button', { name: 'Favoritar' }).click();
	await expect(ana.page.locator('.row .star')).toHaveCount(1);

	await ana.page.locator('header a.who').click();
	await expect(ana.page.locator('.starred li')).toHaveCount(1);
	await expect(ana.page.locator('.starred li')).toContainText('Você');
	await expect(ana.page.locator('.starred li')).toContainText('ideia do churrasco');
	await ana.page.locator('.starred a').click();
	await expect(ana.page.locator('.row.flash')).toContainText('ideia do churrasco');
});

test('favoritar uma mensagem lá em cima não leva a conversa de volta ao fim', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await adicionarUmAoOutro(maria, joao);
	// mensagens altas, a última minha: antes, qualquer recarga da lista rolava até o fim
	const alta = (n: number) => `mensagem ${n}\n` + 'linha\n'.repeat(14);
	for (let n = 1; n <= 8; n++) {
		await joao.page.getByLabel('Mensagem').fill(alta(n));
		await joao.page.getByRole('button', { name: 'Enviar', exact: true }).click();
	}
	await expect(joao.page.locator('.row.mine')).toHaveCount(8);
	const rolagem = () => joao.page.locator('.messages').evaluate((el) => el.scrollTop);
	await joao.page.locator('.messages').evaluate((el) => (el.scrollTop = 0));
	await expect.poll(rolagem).toBe(0);

	await linha(joao, 'mensagem 1').locator('.bubble').click({ button: 'right' });
	await menu(joao).getByRole('button', { name: 'Favoritar' }).click();
	await expect(joao.page.locator('.row .star')).toHaveCount(1);
	await joao.page.waitForTimeout(500);
	expect(await rolagem()).toBe(0);
});
