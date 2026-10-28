// Entregue e lida (RF-50, 51): o sinal da mensagem muda quando o outro aparelho a recebe e quando a conversa é vista.
import { abrirConversa, abrirConversaQuandoChegar, abrirPedido, adicionarPeloConvite, adicionarUmAoOutro, enviarTexto, expect, test } from '../ajudantes.ts';

test('a mensagem passa a entregue e a lida; sem a confirmação de leitura, para em entregue', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await adicionarUmAoOutro(maria, joao);

	// Maria abre a conversa quando a mensagem chega: recebe e lê
	await enviarTexto(joao.page, 'oi, Maria');
	await abrirConversaQuandoChegar(maria.page, 'João');
	await expect(joao.page.locator('.row.mine', { hasText: 'oi, Maria' }).getByLabel('enviada e lida')).toBeVisible({ timeout: 30_000 });

	// Maria desliga a confirmação de leitura em Ajustes e volta para a conversa
	await maria.page.goto('./ajustes');
	await maria.page.getByLabel('Confirmação de leitura').uncheck();
	await abrirConversa(maria.page, 'João');

	await enviarTexto(joao.page, 'e agora?');
	await expect(maria.page.locator('.row', { hasText: 'e agora?' })).toBeVisible({ timeout: 30_000 });
	await expect(joao.page.locator('.row.mine', { hasText: 'e agora?' }).getByLabel('enviada e entregue')).toBeVisible({ timeout: 30_000 });
	// dá tempo de uma "lida" indevida chegar
	await joao.page.waitForTimeout(4_000);
	await expect(joao.page.locator('.row.mine', { hasText: 'e agora?' }).getByLabel('enviada e entregue')).toBeVisible();
	await expect(joao.page.locator('.row.mine').getByLabel('enviada e lida')).toHaveCount(1);
});

test('pedido de mensagem não ganha sinal de entrega; aceitar o pedido e ler dá "lida"', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await adicionarPeloConvite(maria, joao); // o João tem a Maria nos contatos; ela não tem o João
	await enviarTexto(joao.page, 'oi Maria, sou o João');

	// Maria vê o pedido, mas sem aceitar nada o João não sabe se chegou (RF-12)
	await abrirPedido(maria.page, 'João');
	await expect(maria.page.locator('.row', { hasText: 'oi Maria, sou o João' })).toBeVisible({ timeout: 30_000 });
	await joao.page.waitForTimeout(4_000);
	await expect(joao.page.locator('.row.mine', { hasText: 'oi Maria' }).getByLabel('enviada e entregue')).toHaveCount(0);
	await expect(joao.page.locator('.row.mine', { hasText: 'oi Maria' }).getByLabel('enviada e lida')).toHaveCount(0);

	// aceitou e a conversa está à vista: a confirmação sai
	await maria.page.getByRole('button', { name: 'Aceitar' }).click();
	await expect(joao.page.locator('.row.mine', { hasText: 'oi Maria' }).getByLabel('enviada e lida')).toBeVisible({ timeout: 30_000 });
});
