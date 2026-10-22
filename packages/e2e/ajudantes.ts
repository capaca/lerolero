// Auxiliares da suíte: cada pessoa é um contexto do navegador (IndexedDB próprio, como um aparelho).
// Erro de JavaScript na página faz o teste falhar no fim, mesmo que os passos tenham passado.
import { test as base, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

export { expect };

export const PIN = '123456';

export type Pessoa = { nome: string; page: Page; frase: string[] };

/** Digita no PIN em bolinhas: o campo de verdade é invisível, então foca e digita pelo teclado. */
export async function digitarPin(page: Page, id: string, pin: string) {
	await page.locator(`#${id}`).focus();
	await page.keyboard.type(pin);
}

export const noInicio = (page: Page) => expect(page.getByRole('button', { name: 'Nova conversa' })).toBeVisible({ timeout: 20_000 });

/** Cria a conta pela interface, guarda a frase e deixa a conferência para depois (fica no início). */
export async function criarConta(page: Page, nome: string, pin = PIN): Promise<string[]> {
	await page.goto('./');
	await page.getByRole('link', { name: 'Criar minha conta' }).or(page.getByRole('button', { name: 'Criar minha conta' })).click();
	await page.locator('#nome').fill(nome);
	await page.getByRole('button', { name: 'Continuar' }).click();
	await digitarPin(page, 'pin', pin);
	await page.keyboard.type(pin); // o foco pula sozinho para a confirmação
	await expect(page.getByRole('heading', { name: 'Sua frase de recuperação' })).toBeVisible({ timeout: 20_000 });
	const frase = (await page.locator('ol li').allTextContents()).map((t) => t.replace(/^\d+/, '').trim());
	await page.getByLabel('Guardei as 12 palavras').check();
	await page.getByRole('button', { name: 'Continuar' }).click();
	await page.getByRole('button', { name: 'Fazer depois' }).click();
	await noInicio(page);
	return frase;
}

/** Esquece a sessão aberta (vale 5 min): a próxima abertura do app pede o PIN. */
export const vencerSessao = (page: Page) =>
	page.evaluate(
		() =>
			new Promise<void>((ok, falha) => {
				const req = indexedDB.open('lerolero');
				req.onerror = () => falha(req.error);
				req.onsuccess = () => {
					const tx = req.result.transaction('settings', 'readwrite');
					tx.objectStore('settings').delete('sessaoAberta');
					tx.oncomplete = () => ok();
				};
			})
	);

type Fixtures = {
	/** aparelho sem conta: um contexto novo do navegador */
	novoAparelho: () => Promise<Page>;
	/** aparelho com conta criada, já no início */
	novaPessoa: (nome: string) => Promise<Pessoa>;
};

export const test = base.extend<Fixtures>({
	novoAparelho: async ({ browser }: { browser: Browser }, use, info) => {
		const erros: string[] = [];
		const contextos: BrowserContext[] = [];
		await use(async () => {
			const { baseURL, viewport, locale } = info.project.use;
			const contexto = await browser.newContext({ baseURL, viewport, locale });
			await contexto.grantPermissions(['clipboard-read', 'clipboard-write']);
			contextos.push(contexto);
			const page = await contexto.newPage();
			page.on('pageerror', (e) => erros.push(e.message));
			return page;
		});
		await Promise.all(contextos.map((c) => c.close()));
		expect(erros, 'erros de JavaScript na página').toEqual([]);
	},
	novaPessoa: async ({ novoAparelho }, use) => {
		await use(async (nome) => {
			const page = await novoAparelho();
			return { nome, page, frase: await criarConta(page, nome) };
		});
	}
});
