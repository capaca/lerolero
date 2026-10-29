// Editar mensagem (RF-24) e mencionar no grupo com @ (RF-35): a edição troca o texto nas duas pontas, com a marca
// "editada"; a menção guarda a chave e cada um vê o nome que conhece, com destaque para quem foi mencionado.
import type { Page } from '@playwright/test';
import { abrirConversaQuandoChegar, adicionarUmAoOutro, enviarTexto, expect, test, type Pessoa } from '../ajudantes.ts';

const menu = (p: Pessoa) => p.page.getByRole('dialog', { name: 'Opções da mensagem' });

async function abrirGrupo(page: Page, nome: string) {
	await expect(async () => {
		await page.goto('./');
		await expect(page.locator('.conversations a', { hasText: nome })).toBeVisible({ timeout: 2_000 });
	}).toPass({ timeout: 30_000 });
	await page.locator('.conversations a', { hasText: nome }).click();
}

test('João edita uma mensagem e Maria vê o texto novo, marcado como editada', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await adicionarUmAoOutro(maria, joao);

	await enviarTexto(joao.page, 'chego às 8 da manhã');
	await abrirConversaQuandoChegar(maria.page, 'João');
	await expect(maria.page.getByText('chego às 8 da manhã')).toBeVisible({ timeout: 30_000 });

	// só as minhas têm "Editar"
	await maria.page.locator('.row:not(.mine) .bubble').click({ button: 'right' });
	await expect(menu(maria).getByRole('button', { name: 'Responder' })).toBeVisible();
	await expect(menu(maria).getByRole('button', { name: 'Editar' })).toHaveCount(0);
	await maria.page.keyboard.press('Escape');

	await joao.page.locator('.row.mine .bubble').click({ button: 'right' });
	await menu(joao).getByRole('button', { name: 'Editar' }).click();
	await expect(joao.page.getByText('Editando mensagem')).toBeVisible();
	await expect(joao.page.getByLabel('Mensagem')).toHaveValue('chego às 8 da manhã');
	await joao.page.getByLabel('Mensagem').fill('chego às 9 da manhã');
	await joao.page.getByRole('button', { name: 'Salvar edição' }).click();
	await expect(joao.page.getByText('Editando mensagem')).toBeHidden();
	await expect(joao.page.locator('.row.mine')).toHaveCount(1); // não virou mensagem nova
	await expect(joao.page.locator('.row.mine')).toContainText('chego às 9 da manhã');
	await expect(joao.page.locator('.row.mine .edited')).toHaveText('editada');

	const daMaria = maria.page.locator('.row:not(.mine)');
	await expect(daMaria).toContainText('chego às 9 da manhã', { timeout: 30_000 });
	await expect(daMaria.locator('.edited')).toHaveText('editada');
	await expect(daMaria).toHaveCount(1);
});

test('Ana menciona Bia no grupo: Bia vê a menção destacada, com o nome que conhece', async ({ novaPessoa }) => {
	const [ana, bia, caio] = await Promise.all(['Ana', 'Bia', 'Caio'].map(novaPessoa));
	for (const p of [bia, caio]) await adicionarUmAoOutro(p, ana);

	await ana.page.goto('./grupo/novo');
	await ana.page.locator('#nome').fill('Turma');
	for (const n of ['Bia', 'Caio']) await ana.page.locator('.person', { hasText: n }).click();
	await ana.page.getByRole('button', { name: 'Criar grupo' }).click();
	await expect(ana.page.locator('.notice-line', { hasText: 'Você criou o grupo “Turma”' })).toBeVisible();

	// "@Bi" abre a lista só com a Bia; escolher põe o nome no campo
	await ana.page.getByLabel('Mensagem').pressSequentially('oi @Bi');
	const lista = ana.page.getByRole('list', { name: 'Mencionar alguém' });
	await expect(lista.getByRole('button')).toHaveText(['@Bia']);
	await lista.getByRole('button', { name: '@Bia' }).click();
	await expect(ana.page.getByLabel('Mensagem')).toHaveValue('oi @Bia ');
	await ana.page.getByLabel('Mensagem').pressSequentially('traz o bolo?');
	await ana.page.getByRole('button', { name: 'Enviar', exact: true }).click();
	const minha = ana.page.locator('.row.mine', { hasText: 'traz o bolo?' });
	await expect(minha.locator('.mention')).toHaveText('@Bia');

	// a Bia foi mencionada: destaque; o Caio, que não é contato da Bia, vê o mesmo texto com o nome que ele conhece
	await abrirGrupo(bia.page, 'Turma');
	const naBia = bia.page.locator('.row:not(.mine)', { hasText: 'traz o bolo?' });
	await expect(naBia.locator('.mention.me')).toHaveText('@Você', { timeout: 30_000 });
	await abrirGrupo(caio.page, 'Turma');
	const noCaio = caio.page.locator('.row:not(.mine)', { hasText: 'traz o bolo?' });
	await expect(noCaio.locator('.mention')).toHaveText('@~Bia', { timeout: 30_000 });
	await expect(noCaio.locator('.mention.me')).toHaveCount(0);
	// a prévia da lista também mostra o nome, não a chave
	await caio.page.goto('./');
	await expect(caio.page.locator('.conversations a', { hasText: 'Turma' }).locator('.preview')).toContainText('oi @~Bia traz o bolo?');
});
