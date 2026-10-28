// Pedidos de mensagem e bloqueio (RF-12, RF-13): quem não é contato vai para Contatos, sem link nem áudio abertos;
// aceitar vira conversa normal; bloquear apaga e descarta; desbloquear volta como pedido. Grupo para o qual alguém que
// não é contato me adicionou também é pedido (RF-12).
import { adicionarPeloConvite, enviarAudio, enviarTexto, expect, test } from '../ajudantes.ts';

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

test('grupo de quem não é contato vira pedido; aceitar o põe na lista e bloquear o descarta', async ({ novaPessoa }) => {
	const [ana, bia, caio] = await Promise.all(['Ana', 'Bia', 'Caio'].map(novaPessoa));
	await adicionarPeloConvite(bia, ana); // a Ana tem a Bia e o Caio; eles não têm a Ana
	await adicionarPeloConvite(caio, ana);
	for (const nome of ['Amigos', 'Vizinhos']) {
		await ana.page.goto('./grupo/novo');
		await ana.page.locator('#nome').fill(nome);
		for (const n of ['Bia', 'Caio']) await ana.page.locator('.person', { hasText: n }).click();
		await ana.page.getByRole('button', { name: 'Criar grupo' }).click();
		await expect(ana.page.locator('.notice-line', { hasText: `Você criou o grupo “${nome}”` })).toBeVisible();
	}
	await ana.page.getByLabel('Mensagem').fill('oi, veja https://exemplo.com.br/x');
	await ana.page.getByRole('button', { name: 'Enviar', exact: true }).click();
	await expect(ana.page.locator('.row.mine', { hasText: 'oi, veja' }).getByLabel('enviada')).toBeVisible();

	// a lista da Bia fica limpa; só o ponto no ícone de Contatos
	await bia.page.goto('./');
	await expect(bia.page.getByRole('link', { name: 'Contatos (há pedidos de mensagem)' })).toBeVisible({ timeout: 20_000 });
	await expect(bia.page.locator('.conversations a')).toHaveCount(0);
	await bia.page.getByRole('link', { name: /^Contatos/ }).click();
	await expect(bia.page.getByRole('heading', { name: 'Pedidos de mensagem (2)' })).toBeVisible();
	await bia.page.getByRole('link', { name: /Vizinhos/ }).click();

	// aberto, mas fechado: sem link, sem campo de mensagem
	await expect(bia.page.getByText('Pedido de grupo: quem te adicionou não está nos seus contatos.')).toBeVisible();
	await expect(bia.page.locator('.row:not(.mine) a')).toHaveCount(0);
	await expect(bia.page.getByText('Aceite o pedido para participar do grupo.')).toBeVisible();
	await expect(bia.page.getByLabel('Mensagem')).toHaveCount(0);

	// a Ana só vê a Bia no grupo depois do aceite
	await bia.page.getByRole('button', { name: 'Aceitar' }).click();
	await expect(bia.page.getByText('Pedido de grupo')).toHaveCount(0);
	await enviarTexto(bia.page, 'cheguei');
	await bia.page.goto('./');
	await expect(bia.page.locator('.conversations a', { hasText: 'Vizinhos' })).toBeVisible();
	await expect(bia.page.locator('.conversations a', { hasText: 'Amigos' })).toHaveCount(0);

	// o Caio bloqueia um deles: o grupo e quem o criou saem, e o grupo não volta com o que a Ana disser depois
	await caio.page.goto('./contatos');
	await caio.page.getByRole('link', { name: /Amigos/ }).click();
	await caio.page.getByRole('button', { name: 'Bloquear' }).click();
	await expect(caio.page).toHaveURL(/\/contatos\/?$/);
	await expect(caio.page.getByRole('heading', { name: 'Bloqueados (1)' })).toBeVisible();
	await enviarTexto(ana.page, 'ninguém responde?');
	await caio.page.goto('./');
	await caio.page.waitForTimeout(1500);
	await expect(caio.page.locator('.conversations a', { hasText: 'Amigos' })).toHaveCount(0);
});
