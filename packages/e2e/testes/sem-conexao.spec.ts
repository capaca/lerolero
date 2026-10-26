// Aviso de "sem conexão" (etapa 3 de UX): aparece quando o aparelho fica sem internet e some quando volta.
import { expect, test } from '../ajudantes.ts';

test('avisa quando o aparelho fica sem internet e some quando ela volta', async ({ novaPessoa }) => {
	const { page } = await novaPessoa('Maria');
	const aviso = page.getByText('Sem conexão. As mensagens saem quando a internet voltar.');
	await expect(aviso).toHaveCount(0);

	await page.context().setOffline(true);
	await expect(aviso).toBeVisible({ timeout: 5_000 });

	await page.context().setOffline(false);
	await expect(aviso).toHaveCount(0, { timeout: 15_000 });
});
