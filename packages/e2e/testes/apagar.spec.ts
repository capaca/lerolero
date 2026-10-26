// Apagar mensagens (RF-25): para todos some dos dois lados e o arquivo sai dos Blossom; para mim só daqui.
import type { Page } from '@playwright/test';
import { abrirConversa, adicionarUmAoOutro, enviarAudio, enviarTexto, expect, test } from '../ajudantes.ts';

/** Endereços do arquivo da (única) mensagem com mídia, como guardados no aparelho. */
const urlsDaMidia = (page: Page) =>
	page.evaluate(
		() =>
			new Promise<string[]>((ok, falha) => {
				const req = indexedDB.open('lerolero');
				req.onerror = () => falha(req.error);
				req.onsuccess = () => {
					const get = req.result.transaction('messages').objectStore('messages').getAll();
					get.onsuccess = () => ok(get.result.find((m) => m.media)?.media.urls ?? []);
				};
			})
	);

async function apagarParaTodos(page: Page, balao: ReturnType<Page['locator']>) {
	await balao.click({ button: 'right' });
	const menu = page.getByRole('dialog', { name: 'Opções da mensagem' });
	await menu.getByRole('button', { name: 'Apagar para todos' }).click();
	await expect(menu.getByText('Apagar para todos?')).toBeVisible();
	await menu.getByRole('button', { name: 'Apagar para todos' }).click();
}

test('apagar para todos (texto e áudio) e apagar para mim', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await adicionarUmAoOutro(maria, joao);
	await enviarAudio(joao.page);
	await enviarTexto(joao.page, 'mensagem que vou apagar');

	await abrirConversa(maria.page, 'João');
	await expect(maria.page.locator('.player')).toBeVisible();
	await expect(maria.page.getByText('mensagem que vou apagar')).toBeVisible();
	const urls = await urlsDaMidia(maria.page);
	expect(urls).toHaveLength(2);
	const status = (url: string) => maria.page.request.get(url).then((r) => r.status());
	for (const url of urls) expect(await status(url)).toBe(200);

	// texto: some dos dois lados, a Maria vê sem recarregar
	await apagarParaTodos(joao.page, joao.page.locator('.row.mine .bubble', { hasText: 'mensagem que vou apagar' }));
	await expect(joao.page.getByText('Você apagou esta mensagem')).toBeVisible();
	await expect(maria.page.getByText('Esta mensagem foi apagada')).toBeVisible();
	await expect(maria.page.getByText('mensagem que vou apagar')).toHaveCount(0);

	// áudio: some da Maria e o arquivo sai dos dois servidores
	await apagarParaTodos(joao.page, joao.page.locator('.row.mine .bubble:has(.player)'));
	await expect(maria.page.locator('.player')).toHaveCount(0);
	for (const url of urls) await expect.poll(() => status(url)).toBe(404);

	// mensagem de outra pessoa: só "Apagar para mim", e não afeta quem mandou
	await enviarTexto(joao.page, 'esta a Maria apaga só para ela');
	const balao = maria.page.locator('.row .bubble', { hasText: 'esta a Maria apaga só para ela' });
	await balao.click({ button: 'right' });
	const menu = maria.page.getByRole('dialog', { name: 'Opções da mensagem' });
	await expect(menu.getByRole('button', { name: 'Apagar para todos' })).toHaveCount(0);
	await menu.getByRole('button', { name: 'Apagar para mim' }).click();
	await expect(balao).toHaveCount(0);
	await joao.page.reload();
	await expect(joao.page.getByText('esta a Maria apaga só para ela')).toBeVisible();
});
