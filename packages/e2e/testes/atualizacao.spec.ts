// Atualização do app (RNF-33) e autocorreção da tela branca: o que mantém os PWAs instalados atualizando.
import type { AddressInfo } from 'node:net';
import type { Page } from '@playwright/test';
import { APP_URL, pagesServer } from '../servidores.ts';
import { criarConta, expect, noInicio, test } from '../ajudantes.ts';

for (const [quando, procurar] of [
	['ao voltar para o app', (page: Page) => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))],
	['sozinho com o app aberto', (page: Page) => page.clock.fastForward('05:00')]
] as const) test(`versão nova: o aviso aparece ${quando} e "Atualizar" recarrega`, async ({ novoAparelho, request }) => {
	// um servidor só deste teste (outra origem), para a "publicação" não chegar aos outros que rodam junto
	let versao: string | undefined;
	const relays = await (await request.get(APP_URL + 'relays.json')).text();
	const servidor = pagesServer(relays, { versao: () => versao });
	await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok));
	const { port } = servidor.address() as AddressInfo;
	try {
		const page = await novoAparelho(`http://127.0.0.1:${port}/lerolero/`);
		await page.clock.install();
		await criarConta(page, 'Maria');
		await page.waitForFunction(async () => !!navigator.serviceWorker.controller && (await navigator.serviceWorker.ready).active?.state === 'activated');
		await expect(page.getByText('Nova versão disponível.')).toHaveCount(0);

		// sai uma versão nova: procura atualização sem fechar nada
		versao = 'v2';
		await procurar(page);
		const aviso = page.getByRole('status').filter({ hasText: 'Nova versão disponível.' });
		await expect(aviso).toBeVisible();

		await aviso.getByRole('button', { name: 'Atualizar' }).click();
		await noInicio(page);
		await expect(page.getByText('Nova versão disponível.')).toHaveCount(0);
	} finally {
		servidor.close();
	}
});

// Sem service worker, para o código quebrado vir da rede como numa cópia antiga do site
test.describe(() => {
	test.use({ serviceWorkers: 'block' });

	test('código que não carrega: apaga as cópias e recarrega uma vez, sem entrar em laço', async ({ novoAparelho }) => {
		const page = await novoAparelho();
		await page.route('**/_app/immutable/entry/app.*.js', (route) => route.fulfill({ status: 404, body: '' }));
		let carregamentos = 0;
		page.on('load', () => carregamentos++);
		// o próprio erro de carregamento é o que se testa aqui
		page.removeAllListeners('pageerror');
		await page.goto('./');
		await expect.poll(() => carregamentos, { timeout: 10_000 }).toBe(2);
		await page.waitForTimeout(3000);
		expect(carregamentos).toBe(2);

		// com o código de volta, a próxima abertura funciona
		await page.unroute('**/_app/immutable/entry/app.*.js');
		await page.goto('./');
		await expect(page).toHaveURL(/\/bem-vindo$/);
	});
});
