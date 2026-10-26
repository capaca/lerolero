// Mensagem para um contato novo com os relays fora do ar: aparece na hora como "enviando" e fica guardada, em vez de
// sumir enquanto o app busca onde a pessoa recebe (RNF-12; bug visto pelo Pedro em 2026-10).
import { adicionarPeloConvite, expect, test } from '../ajudantes.ts';

test('mensagem para contato novo aparece como enviando mesmo com os relays fora do ar', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await adicionarPeloConvite(maria, joao);

	// conexões novas ficam abertas e mudas: a busca do 10050 da Maria espera o prazo inteiro (~10 s). Recarrega
	// para não sobrar nenhuma conexão antiga, que ainda funcionaria.
	await joao.page.routeWebSocket(/.*/, () => {});
	await joao.page.reload();
	await expect(joao.page.getByLabel('Mensagem')).toBeVisible();

	await joao.page.getByLabel('Mensagem').fill('Oi Maria, estou sem rede');
	await joao.page.getByRole('button', { name: 'Enviar', exact: true }).click();

	const balao = joao.page.locator('.row.mine', { hasText: 'Oi Maria, estou sem rede' });
	await expect(balao.getByLabel('enviando')).toBeVisible({ timeout: 3_000 });

	// continua guardada depois de recarregar
	await joao.page.reload();
	await expect(joao.page.locator('.row.mine', { hasText: 'Oi Maria, estou sem rede' })).toBeVisible();
});
