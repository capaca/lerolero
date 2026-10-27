// Pedidos de mensagem e bloqueio (RF-12, RF-13): quem não é contato vai para Contatos, sem link nem áudio abertos;
// aceitar vira conversa normal; bloquear apaga e descarta; desbloquear volta como pedido.
import { adicionarPeloConvite, enviarAudio, expect, test } from '../ajudantes.ts';

test('desconhecido vira pedido em Contatos, com ponto no ícone; aceitar abre a conversa', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await adicionarPeloConvite(maria, joao); // o João tem a Maria nos contatos; ela não tem o João

	await joao.page.getByLabel('Mensagem').fill('oi Maria, veja https://exemplo.com.br/x');
	await joao.page.getByRole('button', { name: 'Enviar', exact: true }).click();
	await expect(joao.page.locator('.row.mine').getByLabel('enviada')).toBeVisible();
	await enviarAudio(joao.page, 1);

	// a lista de conversas da Maria fica limpa; só um ponto no ícone de Contatos
	await maria.page.goto('./');
	await expect(maria.page.getByRole('link', { name: 'Contatos (há pedidos de mensagem)' })).toBeVisible({ timeout: 20_000 });
	await expect(maria.page.locator('.conversations a')).toHaveCount(0);

	await maria.page.getByRole('link', { name: /^Contatos/ }).click();
	await expect(maria.page.getByRole('heading', { name: 'Pedidos de mensagem (1)' })).toBeVisible();
	await maria.page.getByRole('link', { name: /João/ }).click();

	// aberto, mas fechado: texto sem link e áudio sem player
	await expect(maria.page.getByText('Pedido de mensagem: esta pessoa não está nos seus contatos.')).toBeVisible();
	await expect(maria.page.locator('.row:not(.mine) a')).toHaveCount(0);
	await expect(maria.page.getByText('Áudio de quem não é seu contato')).toBeVisible();
	await expect(maria.page.locator('.player')).toHaveCount(0);

	// o primeiro contato da Maria vem de um pedido: é aqui que a frase é oferecida (Q-U1)
	await maria.page.getByRole('button', { name: 'Aceitar' }).click();
	await expect(maria.page.getByRole('heading', { name: 'Guarde sua frase de recuperação' })).toBeVisible();
	await maria.page.getByRole('button', { name: 'Depois' }).click();
	await expect(maria.page.getByRole('heading', { name: 'João' })).toBeVisible();
	await maria.page.goto('./');
	await maria.page.locator('.conversations a', { hasText: 'João' }).click();
	await expect(maria.page.getByText('Pedido de mensagem: esta pessoa não está nos seus contatos.')).toHaveCount(0);
	await expect(maria.page.locator('.row:not(.mine) a')).toHaveCount(1);
	await expect(maria.page.locator('.player')).toHaveCount(1);

	await maria.page.goto('./');
	await expect(maria.page.locator('.conversations a', { hasText: 'João' })).toBeVisible();
	await expect(maria.page.getByRole('link', { name: 'Contatos', exact: true })).toBeVisible(); // sem ponto
});

test('bloquear apaga a conversa e descarta o que vier; desbloquear volta como pedido', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await adicionarPeloConvite(maria, joao);
	await joao.page.getByLabel('Mensagem').fill('primeira');
	await joao.page.getByRole('button', { name: 'Enviar', exact: true }).click();
	await expect(joao.page.locator('.row.mine').getByLabel('enviada')).toBeVisible();

	await maria.page.goto('./contatos');
	await maria.page.getByRole('link', { name: /João/ }).click();
	await maria.page.getByRole('button', { name: 'Bloquear' }).click();
	await expect(maria.page).toHaveURL(/\/contatos\/?$/);
	await expect(maria.page.getByRole('heading', { name: 'Pedidos de mensagem (1)' })).toHaveCount(0);
	await expect(maria.page.getByRole('heading', { name: 'Bloqueados (1)' })).toBeVisible();

	// o João segue escrevendo, sem saber; nada aparece para a Maria
	await joao.page.getByLabel('Mensagem').fill('segunda');
	await joao.page.getByRole('button', { name: 'Enviar', exact: true }).click();
	await expect(joao.page.locator('.row.mine', { hasText: 'segunda' }).getByLabel('enviada')).toBeVisible();
	await maria.page.goto('./');
	await maria.page.waitForTimeout(1500);
	await expect(maria.page.locator('.conversations a')).toHaveCount(0);
	await expect(maria.page.getByRole('link', { name: 'Contatos', exact: true })).toBeVisible();

	// desbloquear: a próxima mensagem cai nos pedidos, sem as antigas
	await maria.page.goto('./contatos');
	await maria.page.getByRole('link', { name: /João/ }).click();
	await maria.page.getByRole('button', { name: 'Desbloquear' }).click();
	await joao.page.getByLabel('Mensagem').fill('terceira');
	await joao.page.getByRole('button', { name: 'Enviar', exact: true }).click();
	await expect(joao.page.locator('.row.mine', { hasText: 'terceira' }).getByLabel('enviada')).toBeVisible();
	await maria.page.goto('./');
	await expect(maria.page.getByRole('link', { name: 'Contatos (há pedidos de mensagem)' })).toBeVisible({ timeout: 20_000 });
	await maria.page.getByRole('link', { name: /^Contatos/ }).click();
	await maria.page.getByRole('link', { name: /João/ }).click();
	await expect(maria.page.locator('.row:not(.mine)', { hasText: 'terceira' })).toBeVisible();
	await expect(maria.page.locator('.row:not(.mine)', { hasText: 'primeira' })).toHaveCount(0);
	await expect(maria.page.locator('.row:not(.mine)', { hasText: 'segunda' })).toHaveCount(0);
});
