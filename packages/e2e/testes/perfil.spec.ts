// Cartão de perfil (Q-P5, RF-02): nome e foto vão cifrados junto da primeira mensagem e, quando mudam, a quem já
// conversou comigo; o nome que o contato deu continua valendo (RF-14) e a foto de pedido só aparece depois de aceito (T9).
import type { Page } from '@playwright/test';
import { abrirConversaQuandoChegar, abrirPedido, adicionarPeloConvite, adicionarUmAoOutro, enviarTexto, expect, test } from '../ajudantes.ts';

/** Muda nome e foto em Ajustes > Editar nome e foto (a foto: um quadrado colorido gerado na hora). */
async function mudarPerfil(page: Page, nome: string, foto: 'nova' | 'tirar') {
	await page.goto('./ajustes/perfil');
	if (foto === 'nova') {
		const base64 = await page.evaluate(async () => {
			const canvas = document.createElement('canvas');
			canvas.width = 300;
			canvas.height = 200;
			const context = canvas.getContext('2d')!;
			context.fillStyle = '#c33';
			context.fillRect(0, 0, 300, 200);
			const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
			let binary = '';
			for (const byte of new Uint8Array(await blob.arrayBuffer())) binary += String.fromCharCode(byte);
			return btoa(binary);
		});
		await page.getByTestId('foto-perfil').setInputFiles({ name: 'eu.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') });
		await expect(page.getByAltText('Foto nova, ainda não salva')).toBeVisible();
	} else {
		await page.getByRole('button', { name: 'Tirar foto' }).click();
	}
	await page.getByLabel('Seu nome').fill(nome);
	await page.getByRole('button', { name: 'Salvar' }).click();
	await expect(page.getByRole('status')).toHaveText('Salvo. Seus contatos recebem o perfil novo.', { timeout: 30_000 });
}

/** Abre a conversa pelo contato (conversa ainda vazia não aparece no início). */
async function conversarCom(page: Page, nome: string) {
	await page.goto('./contatos');
	await page.getByRole('link', { name: new RegExp(nome) }).click();
	await page.getByRole('link', { name: 'Conversar' }).click();
}

/** A foto aparece no cabeçalho da conversa aberta. */
const fotoNoCabecalho = (page: Page) => page.locator('header img.avatar');

test('nome e foto chegam com a mensagem e as mudanças chegam sozinhas; o nome que dei ao contato fica', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await adicionarUmAoOutro(maria, joao);

	await mudarPerfil(joao.page, 'João Pedro', 'nova');
	await expect(joao.page.locator('img.avatar')).toBeVisible();
	await conversarCom(joao.page, 'Maria');
	await enviarTexto(joao.page, 'oi, olha minha foto');

	await abrirConversaQuandoChegar(maria.page, 'João');
	await expect(fotoNoCabecalho(maria.page)).toBeVisible({ timeout: 30_000 });
	// a Maria chamou de "João" ao adicionar: é o que aparece; o nome do cartão fica nos detalhes
	await maria.page.goto('./contatos');
	await maria.page.getByRole('link', { name: /João/ }).click();
	await expect(maria.page.getByRole('heading', { name: 'João', exact: true })).toBeVisible();
	await expect(maria.page.getByText('Se apresenta como “João Pedro”.')).toBeVisible();
	await expect(maria.page.locator('main img.avatar')).toBeVisible();

	// sem mensagem nova: tirar a foto chega à Maria, que já conversou com ele
	await mudarPerfil(joao.page, 'Jota', 'tirar');
	await expect(async () => {
		await maria.page.reload();
		await expect(maria.page.getByText('Se apresenta como “Jota”.')).toBeVisible({ timeout: 2_000 });
	}).toPass({ timeout: 30_000 });
	await expect(maria.page.locator('main img.avatar')).toHaveCount(0);
});

test('a foto de quem mandou pedido de mensagem só aparece depois de aceitar (T9)', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await adicionarPeloConvite(maria, joao); // o João tem a Maria; ela não tem o João
	await mudarPerfil(joao.page, 'João', 'nova');
	await conversarCom(joao.page, 'Maria');
	await enviarTexto(joao.page, 'oi Maria, sou eu');

	await expect(async () => {
		await abrirPedido(maria.page, 'João');
		await expect(maria.page.getByText('oi Maria, sou eu')).toBeVisible({ timeout: 2_000 });
	}).toPass({ timeout: 30_000 });
	await expect(fotoNoCabecalho(maria.page)).toHaveCount(0);

	// aceitar leva aos detalhes do contato (antes, a oferta da frase): a foto, guardada desde o pedido, aparece
	await maria.page.getByRole('button', { name: 'Aceitar' }).click();
	const aviso = maria.page.getByRole('button', { name: 'Depois' });
	await expect(aviso.or(maria.page.getByRole('heading', { name: 'João' }))).toBeVisible();
	if (await aviso.isVisible()) await aviso.click();
	await expect(maria.page.locator('main img.avatar')).toBeVisible({ timeout: 30_000 });
});
