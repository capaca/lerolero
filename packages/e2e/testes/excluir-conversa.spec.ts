// Excluir conversa (só para mim): toque longo ou botão direito na lista; o contato fica e mensagem nova recomeça
// a conversa; o outro lado não percebe nada.
import { abrirConversa, adicionarUmAoOutro, enviarTexto, expect, test } from '../ajudantes.ts';

test('excluir conversa: some só aqui, o contato fica e mensagem nova recomeça a conversa', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await adicionarUmAoOutro(maria, joao);
	await enviarTexto(joao.page, 'primeira do João');
	await abrirConversa(maria.page, 'João');
	await expect(maria.page.locator('.row:not(.mine)', { hasText: 'primeira do João' })).toBeVisible();
	await joao.page.goto('./');

	const item = joao.page.locator('.conversations a', { hasText: 'Maria' });
	await item.click({ button: 'right' });
	await expect(joao.page.getByText('Excluir a conversa com Maria?')).toBeVisible();
	await expect(joao.page).not.toHaveURL(/\/conversa\//); // o menu não abriu a conversa
	await joao.page.getByRole('button', { name: 'Cancelar' }).click();
	await expect(item).toBeVisible();

	await item.click({ button: 'right' });
	await joao.page.getByRole('button', { name: 'Excluir conversa' }).click();
	await expect(joao.page.locator('.conversations a')).toHaveCount(0);

	// o contato continua
	await joao.page.getByRole('link', { name: 'Contatos' }).click();
	await expect(joao.page.getByText('Maria')).toBeVisible();

	// a Maria não foi avisada; mensagem nova traz a conversa de volta, sem as antigas
	await expect(maria.page.locator('.row:not(.mine)', { hasText: 'primeira do João' })).toBeVisible();
	await enviarTexto(maria.page, 'resposta da Maria');
	await abrirConversa(joao.page, 'Maria');
	await expect(joao.page.locator('.row', { hasText: 'resposta da Maria' })).toBeVisible();
	await expect(joao.page.locator('.row', { hasText: 'primeira do João' })).toHaveCount(0);
});

test('toque longo na conversa abre o menu sem abrir a conversa', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await adicionarUmAoOutro(maria, joao);
	await enviarTexto(joao.page, 'oi');
	await joao.page.goto('./');
	const box = (await joao.page.locator('.conversations a', { hasText: 'Maria' }).boundingBox())!;
	await joao.page.mouse.move(box.x + 40, box.y + 20);
	await joao.page.mouse.down();
	await joao.page.waitForTimeout(700);
	await joao.page.mouse.up();
	await expect(joao.page.getByText('Excluir a conversa com Maria?')).toBeVisible();
	await expect(joao.page).not.toHaveURL(/\/conversa\//);
});
