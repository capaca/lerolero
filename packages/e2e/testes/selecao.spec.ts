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
	await maria.page.goto('./ajustes/favoritas');
	await expect(maria.page.locator('.starred li')).toHaveCount(2);
	await expect(maria.page.locator('.starred li').first()).toContainText('João');

	// tirar dos favoritos pelo menu de uma mensagem
	await maria.page.locator('.starred a').first().click();
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
