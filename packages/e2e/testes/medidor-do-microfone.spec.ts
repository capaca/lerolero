// Nível do microfone (etapa 3 de UX): enquanto grava, a barra se mexe com o som do microfone simulado.
import { adicionarUmAoOutro, expect, test } from '../ajudantes.ts';

test('o medidor da gravação sobe com o som e some ao cancelar', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await adicionarUmAoOutro(maria, joao);

	await joao.page.getByRole('button', { name: 'Gravar áudio' }).click();
	const barra = joao.page.locator('.recording .meter > span');
	await expect(barra).toBeVisible();
	// o microfone simulado apita; basta a barra passar de zero em algum momento
	await expect
		.poll(() => barra.evaluate((e) => parseFloat((e as HTMLElement).style.width) || 0), { timeout: 10_000 })
		.toBeGreaterThan(0);

	await joao.page.getByRole('button', { name: 'Cancelar gravação' }).click();
	await expect(joao.page.locator('.recording .meter')).toHaveCount(0);
});
