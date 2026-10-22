// Contatos (RF-10..14): convite pelo link antes de ter conta, nome local, o próprio convite, QR pela câmera
// (leitor do navegador e jsQR) e o link colado.
import type { Page } from '@playwright/test';
import { cadastrar, digitarPin, meuConvite, PIN, test, expect, vencerSessao } from '../ajudantes.ts';

/** Troca a câmera por um vídeo com o QR dado; `semLeitorNativo` força o jsQR. */
async function cameraMostrando(page: Page, qrSvg: string, semLeitorNativo = false) {
	await page.addInitScript(
		({ qrSvg, semLeitorNativo }) => {
			if (semLeitorNativo) delete (window as { BarcodeDetector?: unknown }).BarcodeDetector;
			navigator.mediaDevices.getUserMedia = async () => {
				const canvas = Object.assign(document.createElement('canvas'), { width: 640, height: 480 });
				const g = canvas.getContext('2d')!;
				const img = new Image();
				img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(qrSvg);
				await img.decode();
				const desenhar = () => {
					g.fillStyle = '#888';
					g.fillRect(0, 0, 640, 480);
					g.drawImage(img, 170, 90, 300, 300);
				};
				desenhar();
				setInterval(desenhar, 100);
				return canvas.captureStream(10);
			};
		},
		{ qrSvg, semLeitorNativo }
	);
}

async function lerQr(page: Page) {
	await page.goto('./contatos/ler');
	await page.getByRole('button', { name: 'Abrir a câmera' }).click();
	await expect(page).toHaveURL(/\/convite#/);
}

test('convite aberto antes de ter conta, nome local e o próprio convite', async ({ novaPessoa, novoAparelho }) => {
	const maria = await novaPessoa('Maria');
	const convite = await meuConvite(maria.page);

	// sem conta: o convite espera o cadastro e volta depois
	const joao = await novoAparelho();
	await joao.goto(convite);
	await expect(joao).toHaveURL(/\/bem-vindo$/);
	await cadastrar(joao, 'João');
	await expect(joao).toHaveURL(/\/convite#/);
	await expect(joao.getByText('Se apresenta como: Maria')).toBeVisible();
	await joao.locator('#nome').fill('Maria do trabalho');
	await joao.getByRole('button', { name: 'Adicionar' }).click();
	await expect(joao.getByRole('heading', { name: 'Maria do trabalho' })).toBeVisible();
	await expect(joao.getByText('Se apresenta como “Maria”.')).toBeVisible();

	// o nome que eu dou fica só comigo (RF-14)
	await joao.locator('#nome').fill('Maria Souza');
	await joao.getByRole('button', { name: 'Salvar nome' }).click();
	await expect(joao.getByText('Salvo.')).toBeVisible();
	await joao.goto('./contatos');
	await expect(joao.locator('.list a', { hasText: 'Maria Souza' })).toContainText('se apresenta como “Maria”');

	// o próprio convite, aberto com a sessão vencida: retomado depois do PIN e recusado
	await vencerSessao(maria.page);
	await maria.page.goto(convite);
	await expect(maria.page).toHaveURL(/\/desbloquear$/);
	await digitarPin(maria.page, 'pin', PIN);
	await expect(maria.page.getByText('Este é o seu próprio convite.')).toBeVisible();
});

test('QR pela câmera, com o leitor do navegador e com o jsQR, e o link colado', async ({ novaPessoa }) => {
	const maria = await novaPessoa('Maria');
	const convite = await meuConvite(maria.page);
	const qr = await maria.page.getByRole('img', { name: 'QR code do seu convite' }).innerHTML();
	const [joao, pedro] = await Promise.all([novaPessoa('João'), novaPessoa('Pedro')]);

	// leitor nativo quando o navegador tem (macOS, Android); na CI (Linux) cai no jsQR também
	await cameraMostrando(joao.page, qr);
	await lerQr(joao.page);
	await expect(joao.page.getByText('Se apresenta como: Maria')).toBeVisible();
	await joao.page.getByRole('button', { name: 'Adicionar' }).click();
	await expect(joao.page.getByRole('heading', { name: 'Maria' })).toBeVisible();
	await lerQr(joao.page);
	await expect(joao.page.getByText('Esta pessoa já está nos seus contatos como Maria.')).toBeVisible();

	await cameraMostrando(pedro.page, qr, true);
	await lerQr(pedro.page);
	expect(await pedro.page.evaluate(() => 'BarcodeDetector' in window)).toBe(false);
	await expect(pedro.page.getByText('Se apresenta como: Maria')).toBeVisible();

	// colar: lixo dá erro claro; a chave pura de outro app Nostr abre o convite sem nome
	await pedro.page.goto('./contatos/ler');
	await pedro.page.locator('#link').fill('qualquer coisa');
	await pedro.page.getByRole('button', { name: 'Abrir convite' }).click();
	await expect(pedro.page.getByRole('alert')).toContainText('Este não parece ser um convite do Lero-lero');
	await pedro.page.locator('#link').fill('nostr:' + convite.match(/npub1[0-9a-z]+/)![0]);
	await pedro.page.getByRole('button', { name: 'Abrir convite' }).click();
	await expect(pedro.page.getByText('Se apresenta como: (sem nome)')).toBeVisible();
});
