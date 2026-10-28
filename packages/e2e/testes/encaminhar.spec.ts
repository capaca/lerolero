// Encaminhar (RF-28, RF-70): texto e foto vão para outra conversa pelo menu da mensagem, sem subir o arquivo de novo.
import { abrirConversa, adicionarUmAoOutro, enviarTexto, expect, test } from '../ajudantes.ts';

test('João encaminha um texto e uma foto da conversa com Maria para Ana', async ({ novaPessoa }) => {
	const [maria, ana, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('Ana'), novaPessoa('João')]);
	await adicionarUmAoOutro(maria, joao);

	await enviarTexto(joao.page, 'segredo de família');
	const base64 = await joao.page.evaluate(async () => {
		const canvas = document.createElement('canvas');
		canvas.width = 400;
		canvas.height = 300;
		const context = canvas.getContext('2d')!;
		for (let i = 0; i < 200; i++) {
			context.fillStyle = `hsl(${Math.random() * 360} 80% 50%)`;
			context.fillRect(Math.random() * 400, Math.random() * 300, 30, 30);
		}
		const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
		let binary = '';
		for (const byte of new Uint8Array(await blob.arrayBuffer())) binary += String.fromCharCode(byte);
		return btoa(binary);
	});
	await joao.page.getByTestId('foto').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') });
	await expect(joao.page.locator('.row.mine:has(.photo)').getByLabel('enviada')).toBeVisible({ timeout: 30_000 });

	// adicionar a Ana tira o João da conversa; a de Maria já tem mensagens e aparece na lista
	await adicionarUmAoOutro(ana, joao);
	await abrirConversa(joao.page, 'Maria');

	const encaminhar = async (balao: ReturnType<typeof joao.page.locator>) => {
		await balao.click({ button: 'right' });
		await joao.page.getByRole('dialog', { name: 'Opções da mensagem' }).getByRole('button', { name: 'Encaminhar' }).click();
		await joao.page.getByRole('dialog', { name: 'Encaminhar para…' }).getByRole('button', { name: 'Ana' }).click();
		await expect(joao.page.getByRole('status')).toHaveText('Mensagem encaminhada');
	};
	await encaminhar(joao.page.locator('.row.mine', { hasText: 'segredo de família' }).locator('.bubble'));
	await encaminhar(joao.page.locator('.row.mine:has(.photo) .bubble'));

	// Ana recebe os dois e abre a foto
	await abrirConversa(ana.page, 'João');
	await expect(ana.page.locator('.row', { hasText: 'segredo de família' })).toBeVisible({ timeout: 30_000 });
	await expect(ana.page.locator('.photo')).toHaveCount(1, { timeout: 30_000 });
	await ana.page.locator('.photo').click(); // baixa
	await expect(ana.page.locator('.photo img')).toHaveAttribute('src', /^blob:/);
	await ana.page.locator('.photo').click(); // abre
	const aberta = ana.page.getByTestId('foto-aberta');
	await expect(aberta).toBeVisible();
	expect(await aberta.evaluate(async (img: HTMLImageElement) => (await img.decode(), img.naturalWidth))).toBe(400);

	// Maria continua só com os originais
	await abrirConversa(maria.page, 'João');
	await expect(maria.page.locator('.row', { hasText: 'segredo de família' })).toHaveCount(1);
});
