// Nível do microfone (etapa 3 de UX): enquanto grava, a barra se mexe com o som do microfone simulado.
import { adicionarUmAoOutro, expect, test } from '../ajudantes.ts';

test('o medidor da gravação sobe com o som e some ao cancelar', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await adicionarUmAoOutro(maria, joao);

	await joao.page.getByRole('button', { name: 'Gravar áudio' }).click();
	// o contêiner, não a barra: no silêncio a barra tem largura 0 e o Playwright a dá como escondida
	await expect(joao.page.locator('.recording .meter')).toBeVisible();
	// O microfone simulado apita com silêncio entre os apitos: ler a largura num instante pode cair sempre no
	// silêncio (o poll lê a cada 1 s). Guarda a maior largura vista em cada mudança e confere essa.
	const barra = joao.page.locator('.recording .meter > span');
	await barra.evaluate((e) => {
		const el = e as HTMLElement;
		el.dataset.max = '0';
		new MutationObserver(() => {
			el.dataset.max = String(Math.max(Number(el.dataset.max), parseFloat(el.style.width) || 0));
		}).observe(el, { attributes: true, attributeFilter: ['style'] });
	});
	await expect
		.poll(() => barra.evaluate((e) => Number((e as HTMLElement).dataset.max)), { timeout: 10_000 })
		.toBeGreaterThan(0);

	await joao.page.getByRole('button', { name: 'Cancelar gravação' }).click();
	await expect(joao.page.locator('.recording .meter')).toHaveCount(0);
});
