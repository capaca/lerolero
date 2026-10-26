// Conversa entre duas pessoas pelo relay local: convite, envio, recebimento sem recarregar, não lidas e
// o nome que viaja cifrado na primeira mensagem (RF-10..14, RF-20).
import { abrirPedido, adicionarPeloConvite, expect, test } from '../ajudantes.ts';

test('Maria convida, João adiciona e os dois conversam', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);

	await adicionarPeloConvite(maria, joao);

	await joao.page.getByLabel('Mensagem').fill('Oi Maria! Aqui é o João.');
	await joao.page.getByRole('button', { name: 'Enviar', exact: true }).click();
	await expect(joao.page.locator('.row.mine').getByLabel('enviada')).toBeVisible();

	// Maria ainda não tem o João: chega como pedido de mensagem, com o nome que veio na mensagem
	await maria.page.goto('./contatos');
	await expect(maria.page.getByRole('heading', { name: 'Pedidos de mensagem (1)' })).toBeVisible({ timeout: 20_000 });
	await expect(maria.page.getByRole('link', { name: /João/ })).toContainText('Oi Maria! Aqui é o João.');
	await abrirPedido(maria.page, 'João');
	await expect(maria.page.getByText('Pedido de mensagem: esta pessoa não está nos seus contatos.')).toBeVisible();
	await maria.page.getByRole('button', { name: 'Aceitar' }).click();
	await maria.page.getByLabel('Mensagem').fill('Oi João, tudo bem?');
	await maria.page.getByRole('button', { name: 'Enviar', exact: true }).click();

	// João recebe com a conversa aberta, sem recarregar
	await expect(joao.page.locator('.row:not(.mine)', { hasText: 'Oi João, tudo bem?' })).toBeVisible();

	// lida ao abrir: a lista da Maria fica sem não lidas
	await maria.page.getByRole('link', { name: 'Voltar para as conversas' }).click();
	await expect(maria.page.locator('.conversations a', { hasText: 'João' })).toBeVisible();
	await expect(maria.page.locator('.conversations .badge')).toHaveCount(0);
});
