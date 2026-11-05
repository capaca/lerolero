// Auxiliares da suíte: cada pessoa é um contexto do navegador (IndexedDB próprio, como um aparelho).
// Erro de JavaScript na página faz o teste falhar no fim, mesmo que os passos tenham passado.
import { get } from 'node:http';
import { test as base, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { parseInvite } from '../core/src/contacts/invite.ts';
import { createVault } from '../core/src/identity/vault.ts';
import { APP_URL } from './servidores.ts';

export { expect };

export const PIN = '123456';

export type Pessoa = { nome: string; page: Page };

/** Digita no PIN em bolinhas: o campo de verdade é invisível, então foca e digita pelo teclado. */
export async function digitarPin(page: Page, id: string, pin: string) {
	await page.locator(`#${id}`).focus();
	await page.keyboard.type(pin);
}

export const noInicio = (page: Page) => expect(page.getByRole('button', { name: 'Nova conversa' })).toBeVisible({ timeout: 20_000 });

/** Cria a conta pela interface (fica no início). */
export async function criarConta(page: Page, nome: string, pin = PIN) {
	await page.goto('./');
	await cadastrar(page, nome, pin);
	await noInicio(page);
}

/** O cadastro a partir das boas-vindas: nome e PIN, sem a frase (ela vem com o primeiro contato). */
export async function cadastrar(page: Page, nome: string, pin = PIN) {
	await page.getByRole('link', { name: 'Criar minha conta' }).or(page.getByRole('button', { name: 'Criar minha conta' })).click();
	await page.locator('#nome').fill(nome);
	await page.getByRole('button', { name: 'Continuar' }).click();
	await digitarPin(page, 'pin', pin);
	await page.keyboard.type(pin); // o foco pula sozinho para a confirmação
	await expect(page.getByRole('heading', { name: 'Crie um PIN' })).toBeHidden({ timeout: 20_000 });
}

/** As 12 palavras, lidas em Ajustes › Frase de recuperação (pede o PIN). */
export async function verFrase(page: Page, pin = PIN): Promise<string[]> {
	await page.goto('./ajustes/frase');
	await digitarPin(page, 'pin', pin);
	await expect(page.locator('ol li')).toHaveCount(12, { timeout: 20_000 });
	return (await page.locator('ol li').allTextContents()).map((t) => t.replace(/^\d+/, '').trim());
}

/**
 * Adiciona o contato aberto em /convite. O primeiro contato de cada pessoa passa antes por
 * "Guarde sua frase" (Q-U1), que aqui fica para depois.
 */
export async function confirmarConvite(page: Page) {
	await page.getByRole('button', { name: 'Adicionar' }).click();
	const aviso = page.getByRole('heading', { name: 'Guarde sua frase de recuperação' });
	const contato = page.getByRole('button', { name: 'Salvar nome' });
	await expect(aviso.or(contato)).toBeVisible({ timeout: 20_000 });
	if (await aviso.isVisible()) await page.getByRole('button', { name: 'Depois' }).click();
	await expect(contato).toBeVisible();
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
	await confirmarConvite(quem.page);
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
	await page.goto('./contatos?aba=pedidos');
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

/** Ajustes ficam no menu ⋮ da tela inicial. */
export async function abrirAjustes(page: Page) {
	await page.getByRole('button', { name: 'Mais opções' }).click();
	await page.getByRole('dialog', { name: 'Mais opções' }).getByRole('link', { name: 'Ajustes' }).click();
}

/** Abre a primeira conversa da lista do início. */
export async function abrirConversa(page: Page, com: string) {
	await page.goto('./');
	await page.locator('.conversations a', { hasText: com }).click();
}

/** Abre a conversa com quem acabou de escrever: espera ela aparecer na lista (conversa vazia não aparece). */
export async function abrirConversaQuandoChegar(page: Page, com: string) {
	await expect(async () => {
		await page.goto('./');
		await expect(page.locator('.conversations a', { hasText: com })).toBeVisible({ timeout: 2_000 });
	}).toPass({ timeout: 30_000 });
	await page.locator('.conversations a', { hasText: com }).click();
}

/** Apaga uma configuração guardada no aparelho, como se o prazo dela tivesse passado. */
export const esquecerAjuste = (page: Page, chave: string) =>
	page.evaluate(
		(chave) =>
			new Promise<void>((ok, falha) => {
				const req = indexedDB.open('lerolero');
				req.onerror = () => falha(req.error);
				req.onsuccess = () => {
					const tx = req.result.transaction('settings', 'readwrite');
					tx.objectStore('settings').delete(chave);
					tx.oncomplete = () => ok();
				};
			}),
		chave
	);

/** Lê um ajuste guardado no aparelho (tabela `settings`). */
export const lerAjuste = <T>(page: Page, chave: string) =>
	page.evaluate(
		(chave) =>
			new Promise<unknown>((ok, falha) => {
				const req = indexedDB.open('lerolero');
				req.onerror = () => falha(req.error);
				req.onsuccess = () => {
					const get = req.result.transaction('settings').objectStore('settings').get(chave);
					get.onsuccess = () => ok(get.result?.value);
					get.onerror = () => falha(get.error);
				};
			}),
		chave
	) as Promise<T | undefined>;

/** Recupera a conta num aparelho novo pela frase e um PIN; o nome só é pedido se não houver backup (RF-06). */
export async function recuperarConta(page: Page, frase: string[], pin = '246810') {
	await page.goto('./');
	await page.getByRole('link', { name: 'Já tenho uma conta' }).or(page.getByRole('button', { name: 'Já tenho uma conta' })).click();
	await page.locator('#frase').fill(frase.join(' '));
	await digitarPin(page, 'pin', pin);
	await page.keyboard.type(pin);
	await page.getByRole('button', { name: 'Recuperar conta' }).click();
}

/**
 * P5: os relays locais "demoram" com o backup: o pedido do kind 30078 recebe o fim do histórico sem nada até
 * `liberar()`, como o relay que tem o backup e passa do tempo enquanto outro responde que não há.
 */
export async function esconderBackup(page: Page): Promise<() => void> {
	let escondido = true;
	await page.routeWebSocket(
		(url) => url.hostname === '127.0.0.1',
		(ws) => {
			const servidor = ws.connectToServer();
			ws.onMessage((mensagem) => {
				if (escondido && typeof mensagem === 'string') {
					const [tipo, id, ...filtros] = JSON.parse(mensagem) as [string, string, ...{ kinds?: number[] }[]];
					if (tipo === 'REQ' && filtros.some((f) => f.kinds?.includes(30078))) return ws.send(JSON.stringify(['EOSE', id]));
				}
				servidor.send(mensagem);
			});
		}
	);
	return () => {
		escondido = false;
	};
}

/**
 * P5: o relay que tem o backup demorou na restauração e o aparelho seguiu sem ele. Antes do primeiro backup deste
 * aparelho, procura de novo; achando contatos que não tem, pergunta em vez de gravar o quase vazio por cima do bom.
 */
export async function restaurarSemAcharOBackup(novaPessoa: (nome: string) => Promise<Pessoa>, novoAparelho: () => Promise<Page>) {
	const [maria, joao] = await Promise.all(['Maria', 'João'].map(novaPessoa));
	await maria.page.goto(await meuConvite(joao.page));
	await confirmarConvite(maria.page);
	await expect
		.poll(async () => (await lerAjuste<{ content: string }>(maria.page, 'backupPublicado'))?.content ?? '', { timeout: 20_000 })
		.toMatch(/"contacts":\[\{/);
	const frase = await verFrase(maria.page);

	const novo = await novoAparelho();
	const liberar = await esconderBackup(novo);
	await recuperarConta(novo, frase);
	await expect(novo.getByText('Não achamos uma cópia dos seus contatos')).toBeVisible({ timeout: 20_000 });
	liberar();
	await novo.locator('#nome').fill('Maria');
	await novo.getByRole('button', { name: 'Entrar' }).click();
	const aviso = novo.getByRole('dialog', { name: 'Achamos um backup seu' });
	await expect(aviso).toContainText('Ele tem 1 contato que não está neste aparelho.', { timeout: 20_000 });
	return { novo, aviso };
}

/** Um "app antigo" (ou outro app Nostr): manda o embrulho direto ao relay, sem prova de trabalho. */
export async function mandarSemProva(page: Page, texto: string) {
	const { publicKey } = parseInvite(await meuConvite(page));
	// o relay de mensagens local, da lista que o app usa na suíte (pela página: o fetch do Node recusa a porta 4190)
	const url = new URL('relays.json', APP_URL).href;
	const { dm } = await page.evaluate(async (url) => (await (await fetch(url)).json()) as { dm: string[] }, url);
	const vault = createVault({ kdf: { memoryKiB: 64, iterations: 1, parallelism: 1 } });
	await vault.create('123456');
	const wrap = vault.wrapDirectMessage(publicKey, texto, [['nome', 'Loja']]).toRecipient;
	const socket = new WebSocket(dm[0]!);
	await new Promise<void>((ok, falha) => {
		socket.onopen = () => socket.send(JSON.stringify(['EVENT', wrap]));
		socket.onmessage = (e) => {
			const [tipo, id, aceito] = JSON.parse(String(e.data)) as [string, string, boolean];
			if (tipo === 'OK' && id === wrap.id) (aceito ? ok() : falha(new Error('relay recusou')), socket.close());
		};
		socket.onerror = () => falha(new Error('sem conexão com o relay'));
	});
}

/** Esquece a sessão aberta (vale 5 min): a próxima abertura do app pede o PIN. */
/** Apaga a sessão aberta, que o cofre guarda no banco dele (P6): a próxima recarga pede o PIN. */
export const vencerSessao = (page: Page) => page.evaluate(apagarSessao);

/** Roda na página ou no service worker (mesma origem). */
export function apagarSessao() {
	return new Promise<void>((ok, falha) => {
		// como o cofre abre (indexedDbSessionStore): sem a versão, criaria o banco vazio e a sessão não seria mais gravada
		const req = indexedDB.open('lerolero-sessao', 1);
		req.onupgradeneeded = () => req.result.createObjectStore('sessao');
		req.onerror = () => falha(req.error);
		req.onsuccess = () => {
			const db = req.result;
			const tx = db.transaction('sessao', 'readwrite');
			tx.objectStore('sessao').delete('atual');
			tx.oncomplete = () => (db.close(), ok());
		};
	});
}

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
			await criarConta(page, nome);
			return { nome, page };
		});
	}
});
