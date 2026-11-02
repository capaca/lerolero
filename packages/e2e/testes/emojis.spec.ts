// Botão de emojis (RF-29): o painel no campo de mensagem, com busca em português e os mais usados primeiro; o "+" das
// reações (RF-23) abre o mesmo seletor.
import { abrirConversaQuandoChegar, adicionarUmAoOutro, enviarTexto, expect, test } from '../ajudantes.ts';

test('João escreve com emojis do seletor, e o mais usado vai para o topo', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await adicionarUmAoOutro(maria, joao); // João fica na conversa com Maria
	const page = joao.page;
	const campo = page.getByLabel('Mensagem');

	// o emoji entra onde estava o cursor, sem apagar o texto
	await campo.fill('bom dia');
	await campo.press('Home');
	await page.getByRole('button', { name: 'Emojis' }).click();
	await expect(page.getByRole('button', { name: 'Inserir rosto risonho', exact: true })).toBeVisible();

	// busca sem acento acha o nome com acento; o atalho do grupo leva até ele
	await page.getByLabel('Buscar emoji').fill('coracao verm');
	await page.getByRole('button', { name: 'Inserir coração vermelho' }).click();
	await expect(campo).toHaveValue('❤️bom dia');
	await page.getByLabel('Buscar emoji').fill('xyzw');
	await expect(page.getByText('Nenhum emoji com esse nome.')).toBeVisible();
	await page.getByRole('button', { name: 'Bandeiras' }).click();
	await page.getByRole('button', { name: 'Inserir bandeira: Brasil' }).click();
	await expect(campo).toHaveValue('❤️🇧🇷bom dia');

	// voltar ao campo fecha o painel; a mensagem sai com os emojis
	await campo.click();
	await expect(page.getByLabel('Buscar emoji')).toBeHidden();
	await page.getByRole('button', { name: 'Enviar', exact: true }).click();
	await expect(page.locator('.row.mine', { hasText: '❤️🇧🇷bom dia' })).toBeVisible();

	// o usado aparece em "Mais usados" e vem primeiro na busca por "coração"
	await page.getByRole('button', { name: 'Emojis' }).click();
	const usados = page.locator('section', { has: page.getByRole('heading', { name: 'Mais usados' }) });
	await expect(usados.locator('.emoji')).toHaveText(['❤️', '🇧🇷']);
	await page.getByLabel('Buscar emoji').fill('coração');
	await expect(page.locator('.emojis .emoji').first()).toHaveText('❤️');
});

test('o "+" das reações abre o seletor, com busca', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await adicionarUmAoOutro(maria, joao);
	await enviarTexto(joao.page, 'passei na prova');
	await abrirConversaQuandoChegar(maria.page, 'João');
	const doJoao = maria.page.locator('.row:not(.mine)', { hasText: 'passei na prova' });
	await expect(doJoao).toBeVisible({ timeout: 30_000 });

	await doJoao.locator('.bubble').click({ button: 'right' });
	const menu = maria.page.getByRole('dialog', { name: 'Opções da mensagem' });
	await menu.getByRole('button', { name: 'Mais reações' }).click();
	await expect(menu.getByRole('button', { name: 'Responder' })).toBeHidden();
	await menu.getByLabel('Buscar emoji').fill('festa');
	await menu.getByRole('button', { name: 'Reagir com 🥳' }).click();
	await expect(doJoao.getByRole('button', { name: 'Reação 🥳: 1' })).toBeVisible();
	const daMaria = joao.page.locator('.row.mine', { hasText: 'passei na prova' });
	await expect(daMaria.getByRole('button', { name: 'Reação 🥳: 1' })).toBeVisible({ timeout: 30_000 });
});
