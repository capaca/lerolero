// P8: o banco do aparelho não abre. Antes a tela ficava branca para sempre; agora mostra o erro, a versão e
// "Tentar de novo", sem nunca oferecer apagar os dados.
import { digitarPin, expect, noInicio, PIN, quebrarBanco, test } from '../ajudantes.ts';

test('banco que não abre: tela de erro com o texto e a versão, e "Tentar de novo" entra com a conta intacta', async ({ novaPessoa }) => {
	const { page } = await novaPessoa('Maria');
	const consertar = await quebrarBanco(page);
	await page.reload();

	await expect(page.getByRole('heading', { name: 'O Lero-lero não abriu' })).toBeVisible();
	await expect(page.getByText('Sem espaço no aparelho')).toBeVisible();
	await expect(page.getByText(/^Lero-lero \S+/)).toBeVisible();
	await expect(page.getByRole('button', { name: /apagar|limpar/i })).toHaveCount(0);

	await consertar();
	await page.getByRole('button', { name: 'Tentar de novo' }).click();
	// a sessão aberta pode ter vencido no meio: o PIN de sempre basta
	const pin = page.locator('#pin');
	await expect(pin.or(page.getByRole('button', { name: 'Nova conversa' }))).toBeVisible({ timeout: 20_000 });
	if (await pin.isVisible()) await digitarPin(page, 'pin', PIN);
	await noInicio(page);
	await expect(page.getByRole('heading', { name: 'O Lero-lero não abriu' })).toHaveCount(0);
});
