// Possível spam (RF-90, T8): o pedido de quem não é contato e veio sem a prova de trabalho fica à parte em Pedidos,
// sem ponto no ícone nem contagem na aba. Quem usa o app manda a prova sozinho e cai nos pedidos de sempre.
import { adicionarPeloConvite, enviarTexto, expect, mandarSemProva, test } from '../ajudantes.ts';

test('sem a prova, o pedido vai para "Possível spam", sem ponto nem contagem; com ela, é pedido normal', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await mandarSemProva(maria.page, 'Promoção imperdível');

	await maria.page.goto('./contatos?aba=pedidos');
	const spam = maria.page.locator('details', { hasText: 'Possível spam (1)' });
	await expect(spam).toBeVisible({ timeout: 20_000 });
	await expect(maria.page.getByRole('tab', { name: 'Pedidos', exact: true })).toBeVisible(); // sem número
	await expect(maria.page.getByText(/^Nenhum pedido\./)).toBeVisible();
	await spam.locator('summary').click();
	await expect(spam.getByRole('link', { name: /~Loja.*Promoção imperdível/ })).toBeVisible();
	await maria.page.goto('./');
	await expect(maria.page.getByRole('link', { name: 'Contatos', exact: true })).toBeVisible(); // sem ponto

	// o João usa o app: a primeira mensagem sai com a prova e vira pedido de verdade
	await adicionarPeloConvite(maria, joao);
	await enviarTexto(joao.page, 'oi, Maria');
	await maria.page.goto('./');
	await expect(maria.page.getByRole('link', { name: 'Contatos (há pedidos de mensagem)' })).toBeVisible({ timeout: 20_000 });
	await maria.page.goto('./contatos?aba=pedidos');
	await expect(maria.page.getByRole('tab', { name: 'Pedidos (1)' })).toBeVisible();
	await expect(maria.page.locator('details', { hasText: 'Possível spam (1)' })).toBeVisible();
});
