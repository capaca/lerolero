// Mensagem para um contato novo com os relays fora do ar: aparece na hora como "enviando" e fica guardada, em vez de
// sumir enquanto o app busca onde a pessoa recebe (RNF-12; bug visto pelo Pedro em 2026-10).
import { adicionarUmAoOutro, expect, test } from '../ajudantes.ts';

test('mensagem para contato novo aparece como enviando mesmo com os relays fora do ar', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await adicionarUmAoOutro(maria, joao);

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

test('mensagens escritas sem internet saem juntas, na ordem, assim que ela volta', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await adicionarUmAoOutro(maria, joao);

	await joao.page.context().setOffline(true);
	const textos = ['Mensagem 1', 'Mensagem 2', 'Mensagem 3', 'Mensagem 4'];
	for (const texto of textos) {
		await joao.page.getByLabel('Mensagem').fill(texto);
		await joao.page.getByRole('button', { name: 'Enviar', exact: true }).click();
		// cada uma aparece na hora: antes, a seguinte esperava a anterior buscar os relays da Maria (~10 s sem rede)
		await expect(joao.page.locator('.row.mine', { hasText: texto }).getByLabel('enviando')).toBeVisible({ timeout: 3_000 });
	}

	// a primeira não pode ficar para trás: antes, a que falhou primeiro tinha a espera mais longa e saía por último
	await joao.page.context().setOffline(false);
	await expect(joao.page.locator('.row.mine').getByLabel('enviada')).toHaveCount(4, { timeout: 20_000 });

	await maria.page.goto('./');
	await maria.page.locator('.conversations a', { hasText: 'João' }).click();
	await expect(maria.page.locator('.row:not(.mine)')).toHaveCount(4, { timeout: 20_000 });
	expect(await maria.page.locator('.row:not(.mine) p:not(.hint)').allTextContents()).toEqual(textos);
});
