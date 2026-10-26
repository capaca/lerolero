// Endereços nas mensagens (T18): viram link só para quem é contato; de desconhecido continuam texto.
import type { Page } from '@playwright/test';
import { abrirConversa, adicionarPeloConvite, expect, test } from '../ajudantes.ts';

// o link aparece sem o "https://", então a espera usa só o começo da mensagem
async function enviar(page: Page, texto: string, comeco: string) {
	await page.getByLabel('Mensagem').fill(texto);
	await page.getByRole('button', { name: 'Enviar', exact: true }).click();
	await expect(page.locator('.row.mine', { hasText: comeco }).getByLabel('enviada')).toBeVisible();
}

test('endereço de contato vira link seguro; o de desconhecido continua texto', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await adicionarPeloConvite(maria, joao); // o João tem a Maria nos contatos; ela ainda não tem o João

	await enviar(joao.page, 'olha https://exemplo.com.br/promo?x=1, e javascript:alert(1)', 'olha');
	await abrirConversa(maria.page, 'João');
	const dela = maria.page.locator('.row:not(.mine)', { hasText: 'olha https://exemplo.com.br/promo?x=1,' });
	await expect(dela).toBeVisible();
	await expect(dela.locator('a')).toHaveCount(0); // desconhecido: só texto

	await enviar(maria.page, 'veja (www.exemplo.org/a). e ftp://x.com', 'veja');
	const dele = joao.page.locator('.row:not(.mine)', { hasText: 'veja ' });
	await expect(dele).toBeVisible();
	const link = dele.locator('a');
	await expect(link).toHaveCount(1); // só o www; ftp e javascript não
	await expect(link).toHaveText('www.exemplo.org/a');
	await expect(link).toHaveAttribute('href', 'https://www.exemplo.org/a');
	await expect(link).toHaveAttribute('target', '_blank');
	await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
});
