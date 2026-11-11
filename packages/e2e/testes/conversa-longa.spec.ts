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
