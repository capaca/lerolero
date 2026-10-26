// Auxiliares da suíte: cada pessoa é um contexto do navegador (IndexedDB próprio, como um aparelho).
// Erro de JavaScript na página faz o teste falhar no fim, mesmo que os passos tenham passado.
import { get } from 'node:http';
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
	const frase = await cadastrar(page, nome, pin);
	await noInicio(page);
	return frase;
}

/** O cadastro a partir das boas-vindas, até deixar a conferência da frase para depois. */
export async function cadastrar(page: Page, nome: string, pin = PIN): Promise<string[]> {
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
	return frase;
}

/** O link do convite, copiado pelo botão em "Meu convite" (a página fica lá). */
export async function meuConvite(page: Page): Promise<string> {
	await page.goto('./contatos/meu-convite');
	await page.getByRole('button', { name: 'Copiar link' }).click();
	const convite = await page.evaluate(() => navigator.clipboard.readText());
	expect(convite).toContain('/convite#npub1');
	return convite;
}

/** `quem` abre o convite de `de`, adiciona e fica na conversa com ele, ainda vazia. */
export async function adicionarPeloConvite(de: Pessoa, quem: Pessoa) {
	await quem.page.goto(await meuConvite(de.page));
	await expect(quem.page.getByText(`Se apresenta como: ${de.nome}`)).toBeVisible();
	await quem.page.getByRole('button', { name: 'Adicionar' }).click();
	await quem.page.getByRole('link', { name: 'Conversar' }).click();
	await expect(quem.page.getByText('Nenhuma mensagem ainda')).toBeVisible();
}

/** Os dois se adicionam (cada um abre o convite do outro): contatos de verdade, sem pedido de mensagem no meio. */
export async function adicionarUmAoOutro(a: Pessoa, b: Pessoa) {
	await adicionarPeloConvite(b, a);
	await adicionarPeloConvite(a, b); // por último, para `b` ficar na conversa com `a`, como em adicionarPeloConvite
}

/** Abre, por Contatos, o pedido de mensagem de quem ainda não é contato. */
export async function abrirPedido(page: Page, de: string) {
	await page.goto('./contatos');
	await page.getByRole('link', { name: new RegExp(de) }).click();
}

export async function enviarTexto(page: Page, texto: string) {
	await page.getByLabel('Mensagem').fill(texto);
	await page.getByRole('button', { name: 'Enviar', exact: true }).click();
	await expect(page.locator('.row.mine', { hasText: texto }).getByLabel('enviada')).toBeVisible();
}

/** Grava pelo microfone simulado e envia; espera o áudio sair (cifrado, nos dois Blossom, no relay). */
export async function enviarAudio(page: Page, segundos = 2) {
	const antes = await page.locator('.row.mine .player').count();
	await page.getByRole('button', { name: 'Gravar áudio' }).click();
	await expect(page.getByText(/Gravando/)).toBeVisible();
	await page.waitForTimeout(segundos * 1000);
	await page.getByRole('button', { name: 'Enviar áudio' }).click();
	await expect(page.locator('.row.mine:has(.player)').nth(antes).getByLabel('enviada')).toBeVisible({ timeout: 20_000 });
}

/** Abre a primeira conversa da lista do início. */
export async function abrirConversa(page: Page, com: string) {
	await page.goto('./');
	await page.locator('.conversations a', { hasText: com }).click();
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

/** Endereços de relays de fora (ex.: os do convite de comentários) que a suíte desviou para o relay local. */
export const desviados: string[] = [];

/**
 * O convite da conta de comentários traz os relays reais: sem isto, "Enviar comentário" mandava uma mensagem de
 * verdade para a conta do Pedro a cada rodada da suíte (2026-10-26). Qualquer WebSocket que não seja local vai
 * para o relay de mensagens local.
 */
async function desviarRelaysDeFora(contexto: BrowserContext, baseURL: string) {
	// node:http, porque o fetch do Node recusa a porta 4190 do servidor da suíte (lista de portas proibidas)
	const { dm } = await new Promise<{ dm: string[] }>((ok, falha) =>
		get(new URL('relays.json', baseURL), (res) => {
			let corpo = '';
			res.on('data', (parte) => (corpo += parte));
			res.on('end', () => ok(JSON.parse(corpo)));
		}).on('error', falha)
	);
	await contexto.routeWebSocket(
		(url) => url.hostname !== '127.0.0.1' && url.hostname !== 'localhost',
		(ws) => {
			desviados.push(ws.url());
			const local = new WebSocket(dm[0]);
			const aberto = new Promise<void>((ok) => local.addEventListener('open', () => ok()));
			ws.onMessage(async (mensagem) => {
				await aberto;
				local.send(typeof mensagem === 'string' ? mensagem : new Uint8Array(mensagem));
			});
			local.addEventListener('message', (e) => ws.send(e.data));
			ws.onClose(() => local.close());
			local.addEventListener('close', () => ws.close());
		}
	);
}

type Fixtures = {
	/** aparelho sem conta: um contexto novo do navegador (`baseURL` para outro servidor do app) */
	novoAparelho: (baseURL?: string) => Promise<Page>;
	/** aparelho com conta criada, já no início */
	novaPessoa: (nome: string) => Promise<Pessoa>;
};

export const test = base.extend<Fixtures>({
	novoAparelho: async ({ browser, serviceWorkers }: { browser: Browser; serviceWorkers: 'allow' | 'block' }, use, info) => {
		const erros: string[] = [];
		const contextos: BrowserContext[] = [];
		await use(async (baseURL = info.project.use.baseURL) => {
			const { viewport, locale, ignoreHTTPSErrors } = info.project.use;
			const contexto = await browser.newContext({ baseURL, viewport, locale, ignoreHTTPSErrors, serviceWorkers });
			await contexto.grantPermissions(['clipboard-read', 'clipboard-write', 'microphone']);
			contextos.push(contexto);
			await desviarRelaysDeFora(contexto, baseURL!);
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
