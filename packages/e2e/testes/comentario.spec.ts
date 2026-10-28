// Material do teste: o guia e o roteiro abrem sem conta, e "Enviar comentário" chega como conversa cifrada.
import { abrirAjustes, desviados, expect, test } from '../ajudantes.ts';

test('guia e roteiro abrem sem conta, com o link nas boas-vindas', async ({ novoAparelho }) => {
	const page = await novoAparelho();
	await page.goto('./teste');
	await expect(page.getByRole('heading', { name: 'Como testar o Lero-lero' })).toBeVisible();
	await page.goto('./teste/roteiro');
	await expect(page.getByRole('heading', { name: 'Roteiro de aceite' })).toBeVisible();
	await page.goto('./');
	await page.getByRole('link', { name: 'como testar' }).click();
	await expect(page).toHaveURL(/\/teste$/);
});

test('"Enviar comentário" vai como conversa com a equipe, com os dados do aparelho', async ({ novaPessoa }) => {
	const { page } = await novaPessoa('Testadora');
	await abrirAjustes(page);
	await page.getByRole('link', { name: 'Enviar comentário (bug ou sugestão)' }).click();
	await expect(page.locator('pre.device')).toContainText('Versão do app:');
	await page.getByLabel('O que aconteceu ou o que você sugere?').fill('O botão de enviar ficou meio escondido.');
	await page.getByRole('button', { name: 'Enviar', exact: true }).click();

	await expect(page).toHaveURL(/\/conversa\//);
	await expect(page.getByText('Lero-lero (comentários)')).toBeVisible();
	const enviado = page.locator('.row.mine', { hasText: '[Bug] O botão de enviar ficou meio escondido.' });
	await expect(enviado).toContainText('Dados do aparelho');
	await expect(enviado.getByLabel('enviada')).toBeVisible();

	// o convite da conta de comentários traz relays reais: a suíte os desviou para o relay local, nada saiu para a rede
	expect(desviados.some((url) => url.includes('nostr1.com') || url.includes('monostr.com') || url.includes('nmail.li'))).toBe(true);
});
