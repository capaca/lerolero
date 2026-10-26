// Áudio com os servidores de arquivo fora do ar: o balão aparece na hora, tocável e "enviando", e sai sozinho
// quando o servidor volta, sem o aviso "Enviando áudio…" que dava cara de lentidão (RNF-12, pedido do Pedro em
// 2026-10-26). A desistência depois de alguns minutos fica nos testes do core.
import { adicionarUmAoOutro, expect, test } from '../ajudantes.ts';

test('áudio aparece na hora com os Blossom fora do ar e sai quando voltam', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await adicionarUmAoOutro(maria, joao);

	// os Blossom da suíte são os únicos https; os relays e o app são locais sem tls
	const foraDoAr = (url: URL) => url.protocol === 'https:';
	await joao.page.route(foraDoAr, (route) => route.abort('connectionrefused'));

	await joao.page.getByRole('button', { name: 'Gravar áudio' }).click();
	await expect(joao.page.getByText(/Gravando/)).toBeVisible();
	await joao.page.waitForTimeout(1500);
	await joao.page.getByRole('button', { name: 'Enviar áudio' }).click();

	// sem aviso de "enviando" no lugar do balão: o balão já é o áudio, tocável, com o relógio
	await expect(joao.page.getByText('Enviando áudio…')).toHaveCount(0);
	const balao = joao.page.locator('.row.mine:has(.player)');
	await expect(balao.getByLabel('enviando')).toBeVisible({ timeout: 3_000 });
	await expect(balao.getByRole('button', { name: /Tocar|Reproduzir/ })).toBeVisible();

	// o servidor volta: a próxima tentativa (2 a 4 s) sobe e entrega, sem balão repetido
	await joao.page.unroute(foraDoAr);
	await expect(balao.getByLabel('enviada')).toBeVisible({ timeout: 20_000 });
	await expect(joao.page.locator('.row.mine:has(.player)')).toHaveCount(1);

	await maria.page.goto('./');
	await maria.page.locator('.conversations a', { hasText: 'João' }).click();
	await expect(maria.page.locator('.row:not(.mine) .player')).toBeVisible();
});
