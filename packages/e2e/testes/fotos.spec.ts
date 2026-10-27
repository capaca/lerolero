// Fotos (RF-41): anexar da galeria, comprimir, enviar cifrada, prévia no balão, abrir em tela cheia no outro lado.
import { abrirConversa, adicionarUmAoOutro, expect, test } from '../ajudantes.ts';

test('João envia uma foto grande; Maria vê a prévia na lista e abre em tela cheia', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await adicionarUmAoOutro(maria, joao);

	// foto de 3000x2000 com ruído, para passar do limite de lado e de bytes
	const base64 = await joao.page.evaluate(async () => {
		const canvas = document.createElement('canvas');
		canvas.width = 3000;
		canvas.height = 2000;
		const context = canvas.getContext('2d')!;
		for (let i = 0; i < 4000; i++) {
			context.fillStyle = `hsl(${Math.random() * 360} 80% 50%)`;
			context.fillRect(Math.random() * 3000, Math.random() * 2000, 80, 80);
		}
		const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
		let binary = '';
		for (const byte of new Uint8Array(await blob.arrayBuffer())) binary += String.fromCharCode(byte);
		return btoa(binary);
	});
	await joao.page.getByTestId('foto').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') });
	await expect(joao.page.locator('.row.mine:has(.photo)').getByLabel('enviada')).toBeVisible({ timeout: 30_000 });

	await maria.page.goto('./');
	await expect(maria.page.locator('.conversations a', { hasText: 'João' }).locator('.preview')).toHaveText('Foto');
	await abrirConversa(maria.page, 'João');
	const foto = maria.page.locator('.photo');
	await expect(foto).toHaveCount(1);
	// espaço reservado na proporção 3:2 antes de baixar
	const caixa = (await foto.boundingBox())!;
	expect(caixa.width / caixa.height).toBeCloseTo(1.5, 1);

	await foto.click();
	const aberta = maria.page.getByTestId('foto-aberta');
	await expect(aberta).toBeVisible();
	const tamanho = await aberta.evaluate(async (img: HTMLImageElement) => {
		await img.decode();
		return { w: img.naturalWidth, h: img.naturalHeight };
	});
	expect(Math.max(tamanho.w, tamanho.h)).toBeLessThanOrEqual(1600);
	expect(tamanho.w / tamanho.h).toBeCloseTo(1.5, 1);
	await maria.page.getByRole('button', { name: 'Fechar foto' }).click();
	await expect(aberta).toHaveCount(0);
});
