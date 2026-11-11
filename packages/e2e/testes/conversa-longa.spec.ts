// Rajada com a conversa aberta (item 28a, P17): a tela relê só as mensagens que mudaram e junta as que chegam em
// sequência antes de desenhar. Todas têm de aparecer, na ordem e uma vez só, e a "lida" volta para quem escreveu.
import { adicionarUmAoOutro, enviarTexto, expect, test } from '../ajudantes.ts';

const N = 40;

test('uma rajada com a conversa aberta chega inteira, na ordem, e volta como lida', async ({ novaPessoa }) => {
	const [ana, bia] = await Promise.all([novaPessoa('Ana'), novaPessoa('Bia')]);
	await adicionarUmAoOutro(bia, ana); // a Ana fica na conversa
	// a Bia responde antes: assim as mensagens da Ana saem sem prova de trabalho (RF-90) e chegam em rajada
	await enviarTexto(ana.page, 'oi, Bia');
	await bia.page.goto('./');
	await bia.page.locator('.conversations a', { hasText: 'oi, Bia' }).click();
	await enviarTexto(bia.page, 'oi, Ana');

	// sem esperar cada uma sair: elas vão para a fila e chegam juntas
	const campo = ana.page.getByLabel('Mensagem');
	const enviar = ana.page.getByRole('button', { name: 'Enviar', exact: true });
	for (let i = 1; i <= N; i++) {
		await campo.fill(`Rajada ${i}`);
		await enviar.click();
	}

	const recebidas = bia.page.locator('.row:not(.mine)', { hasText: /Rajada \d+/ });
	await expect(recebidas).toHaveCount(N, { timeout: 30_000 });
	const textos = await recebidas.evaluateAll((rows) => rows.map((r) => r.textContent?.match(/Rajada \d+/)?.[0]));
	expect(textos).toEqual(Array.from({ length: N }, (_, i) => `Rajada ${i + 1}`));
	// a última ficou à vista: quem estava no fim continua no fim
	await expect(bia.page.locator('.row', { hasText: `Rajada ${N}` })).toBeInViewport();

	// a "lida" de cada uma é pedida uma vez e chega à Ana
	await expect(ana.page.locator('.row.mine', { hasText: `Rajada ${N}` }).getByLabel('enviada e lida')).toBeVisible({ timeout: 30_000 });
	await expect(ana.page.locator('.row.mine', { hasText: 'Rajada 1' }).first().getByLabel('enviada e lida')).toBeVisible();
});

test('"Carregar anteriores" traz a página de antes uma vez só, na ordem, mesmo com mensagens no mesmo segundo', async ({ novaPessoa }) => {
	const { page } = await novaPessoa('Maria');
	const outro = 'cd'.repeat(32);
	await page.goto(`./conversa/${outro}`);
	// 230 mensagens do contato direto no aparelho; da 25 à 35 no mesmo segundo, bem na divisa da página de 200
	const agora = Math.floor(Date.now() / 1000) - 3600;
	const lista = Array.from({ length: 230 }, (_, i) => [`m${String(i + 1).padStart(3, '0')}`, `Antiga ${i + 1}`, i >= 24 && i < 35 ? agora + 24 : agora + i] as const);
	await page.evaluate(
		({ lista, outro }) =>
			new Promise<void>((ok, falha) => {
				const req = indexedDB.open('lerolero');
				req.onerror = () => falha(req.error);
				req.onsuccess = () => {
					const tx = req.result.transaction('messages', 'readwrite');
					for (const [id, text, createdAt] of lista) {
						tx.objectStore('messages').put({ id, conversationId: 'direta:' + outro, sender: outro, kind: 14, text, createdAt, status: 'recebida', ack: 'lida' });
					}
					tx.oncomplete = () => ok();
				};
			}),
		{ lista, outro }
	);
	await page.reload();

	const linhas = page.locator('.row');
	await expect(linhas).toHaveCount(200);
	await expect(page.locator('.row', { hasText: 'Antiga 230' })).toBeInViewport();
	const botao = page.getByRole('button', { name: 'Carregar mensagens anteriores' });
	// dois toques seguidos: o segundo, durante o carregamento, não pede outra página
	await botao.evaluate((b: HTMLButtonElement) => (b.click(), b.click()));
	await expect(linhas).toHaveCount(230);
	await expect(botao).toHaveCount(0);
	const textos = await linhas.evaluateAll((rows) => rows.map((r) => r.querySelector('p')?.textContent));
	expect(textos).toEqual(lista.map(([, text]) => text));
});
