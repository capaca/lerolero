// P9: a faixa de avisos, para o Pedro falar com todos num incidente. O avisos.json vem do GitHub (simulado aqui),
// não dos relays; a última lista fica guardada no aparelho para valer sem internet e na tela de erro do P8.
import { expect, publicarAvisos, quebrarBanco, test } from '../ajudantes.ts';

const amanha = () => new Date(Date.now() + 86_400_000).toISOString();
const ontem = () => new Date(Date.now() - 86_400_000).toISOString();

test('aviso aparece em todas as telas, fecha só neste aparelho, some na validade e vale sem internet', async ({ novoAparelho, novaPessoa }) => {
	const page = await novoAparelho();
	await publicarAvisos(page, [{ id: 'relay', nivel: 'info', texto: 'O relay X está fora do ar.', ate: amanha() }]);
	// antes de entrar na conta
	await page.goto('./');
	await expect(page).toHaveURL(/\/bem-vindo$/);
	const faixa = page.getByRole('status').filter({ hasText: 'O relay X está fora do ar.' });
	await expect(faixa).toBeVisible();

	// o de problema vem antes, e o vencido não aparece
	await publicarAvisos(page, [
		{ id: 'relay', nivel: 'info', texto: 'O relay X está fora do ar.', ate: amanha() },
		{ id: 'velho', nivel: 'problema', texto: 'Aviso de ontem.', ate: ontem() },
		{ id: 'versao', nivel: 'problema', texto: 'A versão 0.14 perde fotos: atualize.', ate: amanha() }
	]);
	await page.reload();
	await expect(page.getByText('A versão 0.14 perde fotos: atualize.')).toBeVisible();
	await expect(page.getByText('Aviso de ontem.')).toHaveCount(0);

	// fechar mostra o próximo; recarregar não traz o fechado de volta
	await page.getByRole('button', { name: 'Fechar aviso' }).click();
	await expect(faixa).toBeVisible();
	await page.reload();
	await expect(faixa).toBeVisible();
	await expect(page.getByText('A versão 0.14 perde fotos: atualize.')).toHaveCount(0);

	// sem internet (ou com o GitHub fora), fica a última lista que veio
	await publicarAvisos(page, undefined);
	await page.reload();
	await expect(faixa).toBeVisible();

	// arquivo sem avisos: a faixa some
	await publicarAvisos(page, []);
	await page.reload();
	await expect(page).toHaveURL(/\/bem-vindo$/);
	await expect(faixa).toHaveCount(0);

	// com a conta aberta, também aparece, e chega ao voltar para o app sem recarregar
	const { page: maria } = await novaPessoa('Maria');
	await publicarAvisos(maria, [{ id: 'novo', nivel: 'info', texto: 'Tudo normalizado.', ate: amanha() }]);
	await maria.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
	await expect(maria.getByText('Tudo normalizado.')).toBeVisible();
});

test('aviso aparece na tela de erro do banco (P8)', async ({ novaPessoa }) => {
	const { page } = await novaPessoa('Maria');
	await publicarAvisos(page, [{ id: 'banco', nivel: 'problema', texto: 'Sabemos do erro ao abrir.', ate: amanha() }]);
	await quebrarBanco(page);
	await page.reload();
	await expect(page.getByRole('heading', { name: 'O Lero-lero não abriu' })).toBeVisible();
	await expect(page.getByText('Sabemos do erro ao abrir.')).toBeVisible();
});
