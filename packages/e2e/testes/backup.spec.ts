// Backup cifrado (RF-06): num aparelho novo, a frase traz de volta o nome, os contatos com o nome que dei, os
// bloqueios, os grupos e o ajuste de leitura, sem pedir o nome. Favoritas e mensagens antigas não entram.
import { abrirAjustes, adicionarPeloConvite, confirmarConvite, enviarTexto, expect, lerAjuste, meuConvite, noInicio, recuperarConta, test, verFrase } from '../ajudantes.ts';

test('a frase num aparelho novo traz o nome, os contatos, o bloqueio, o grupo e o ajuste de leitura', async ({ novaPessoa, novoAparelho }) => {
	const [maria, joao, caio] = await Promise.all(['Maria', 'João', 'Caio'].map(novaPessoa));
	// o nome que Maria dá ao João fica só com ela (RF-14) e precisa voltar
	await maria.page.goto(await meuConvite(joao.page));
	await maria.page.locator('#nome').fill('Joãozinho');
	await confirmarConvite(maria.page);
	// João escreve antes da troca de aparelho: no novo, a conversa volta já lida (decidido em 2026-10-29)
	await adicionarPeloConvite(maria, joao);
	await enviarTexto(joao.page, 'Oi, Maria!');
	await maria.page.goto(await meuConvite(caio.page));
	await confirmarConvite(maria.page);
	await maria.page.getByRole('button', { name: 'Bloquear' }).click();
	await maria.page.getByRole('dialog').getByRole('button', { name: 'Bloquear' }).click();
	await expect(maria.page.getByRole('button', { name: 'Desbloquear' })).toBeVisible();

	await maria.page.goto('./grupo/novo');
	await maria.page.locator('#nome').fill('Família');
	await maria.page.locator('.person', { hasText: 'Joãozinho' }).click();
	await maria.page.getByRole('button', { name: 'Criar grupo' }).click();
	await expect(maria.page.locator('.notice-line', { hasText: 'Você criou o grupo “Família”' })).toBeVisible();

	await maria.page.goto('./');
	await abrirAjustes(maria.page);
	await maria.page.getByRole('checkbox', { name: 'Confirmação de leitura' }).uncheck();
	await expect.poll(() => lerAjuste(maria.page, 'confirmacaoLeitura')).toBe(false);
	const frase = await verFrase(maria.page);
	// o backup sai uns segundos depois da última mudança, e só se mudou algo
	await expect
		.poll(async () => (await lerAjuste<{ content: string }>(maria.page, 'backupPublicado'))?.content ?? '', { timeout: 20_000 })
		.toMatch(/Joãozinho.*Família.*"confirmacaoLeitura":false/);

	const novo = await novoAparelho();
	await recuperarConta(novo, frase);
	// achou o backup: não pede o nome
	await noInicio(novo);
	await expect(novo.locator('.conversations a', { hasText: 'Família' })).toBeVisible();
	const conversa = novo.locator('.conversations a', { hasText: 'Joãozinho' });
	await expect(conversa).toContainText('Oi, Maria!', { timeout: 20_000 });
	await expect(conversa.locator('.badge')).toHaveCount(0);

	await novo.goto('./contatos');
	await expect(novo.getByText('Joãozinho')).toBeVisible();
	await novo.goto('./contatos?aba=pedidos');
	await expect(novo.getByRole('heading', { name: 'Bloqueados (1)' })).toBeVisible();
	await expect(novo.getByText('Caio')).toBeVisible();

	await novo.goto('./');
	await abrirAjustes(novo);
	await expect(novo.getByText('Nome: Maria')).toBeVisible();
	await expect(novo.getByRole('checkbox', { name: 'Confirmação de leitura' })).not.toBeChecked();
});
