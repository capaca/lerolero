// Tamanho da letra (etapa 3 de UX, RNF-65): a escolha em Ajustes vale na hora, sobrevive a recarregar
// (inclusive na tela do PIN, antes de entrar) e é só do aparelho.
import { expect, noInicio, test } from '../ajudantes.ts';

const tamanho = (page: import('@playwright/test').Page) =>
	page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));

test('a letra cresce em Ajustes e continua assim ao recarregar', async ({ novaPessoa }) => {
	const { page } = await novaPessoa('Maria');
	await page.setViewportSize({ width: 360, height: 740 });
	await page.goto('./ajustes');
	await expect(page.getByRole('radio', { name: 'Normal' })).toBeChecked();
	const normal = await tamanho(page);

	await page.getByText('Grande', { exact: true }).click();
	expect(await tamanho(page)).toBeCloseTo(normal * 1.2, 1);
	await page.getByText('Muito grande', { exact: true }).click();
	expect(await tamanho(page)).toBeCloseTo(normal * 1.4, 1);

	// sem rolagem para os lados, mesmo no maior tamanho e numa tela de celular (os rádios escondidos já vazaram)
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

	await page.reload();
	await expect(page.getByRole('radio', { name: 'Muito grande' })).toBeChecked();
	expect(await tamanho(page)).toBeCloseTo(normal * 1.4, 1);

	await page.getByText('Normal', { exact: true }).click();
	expect(await tamanho(page)).toBeCloseTo(normal, 1);
	await page.goto('./');
	await noInicio(page);
});
