// Arquivos (RF-44) e "Salvar" (RF-45): envio cifrado, balão com nome e tamanho, download sob demanda e bloqueio de
// executável (T22).
import { abrirConversa, adicionarUmAoOutro, expect, test } from '../ajudantes.ts';

const PDF = { name: 'contrato.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 conteúdo de teste') };

test('João envia um PDF; Maria baixa e salva, e o executável é recusado no envio', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await adicionarUmAoOutro(maria, joao);

	await joao.page.getByTestId('arquivo-envio').setInputFiles({ name: 'instalar.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ') });
	await expect(joao.page.getByRole('alert')).toContainText('não pode ser enviado');
	await expect(joao.page.getByTestId('arquivo')).toHaveCount(0);

	await joao.page.getByTestId('arquivo-envio').setInputFiles(PDF);
	await expect(joao.page.locator('.row.mine:has([data-testid="arquivo"])').getByLabel('enviada')).toBeVisible({ timeout: 30_000 });

	await maria.page.goto('./');
	await abrirConversa(maria.page, 'João');
	const cartao = maria.page.getByTestId('arquivo');
	await expect(cartao).toContainText('contrato.pdf', { timeout: 30_000 });
	await expect(cartao).toContainText('toque para baixar');

	// o primeiro toque só baixa
	await cartao.click();
	await expect(cartao).toContainText('toque para salvar');

	const download = maria.page.waitForEvent('download');
	await cartao.click();
	expect((await download).suggestedFilename()).toBe('contrato.pdf');

	// a mesma coisa pelo menu da mensagem
	await cartao.click({ button: 'right' });
	const peloMenu = maria.page.waitForEvent('download');
	await maria.page.getByRole('button', { name: 'Salvar', exact: true }).click();
	expect((await peloMenu).suggestedFilename()).toBe('contrato.pdf');
});

// O balão provisório (o arquivo subindo) e o da mensagem de verdade não podem aparecer juntos: com a mensagem na tela
// antes da cifra (RNF-12), os dois ficavam lado a lado enquanto o cofre cifrava, e o texto em volta piscava (2026-11-18).
test('o balão do arquivo enviado não aparece duplicado na troca do provisório', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await adicionarUmAoOutro(maria, joao);

	await joao.page.evaluate(() => {
		const w = window as unknown as { maxArquivos: number };
		w.maxArquivos = 0;
		const contar = () => (w.maxArquivos = Math.max(w.maxArquivos, document.querySelectorAll('.row.mine [data-testid="arquivo"]').length));
		new MutationObserver(contar).observe(document.body, { childList: true, subtree: true });
	});
	// devagar como o celular de referência: a cifra leva o bastante para os dois balões se encontrarem na tela
	const cdp = await joao.page.context().newCDPSession(joao.page);
	await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
	await joao.page.getByTestId('arquivo-envio').setInputFiles(PDF);
	await expect(joao.page.locator('.row.mine:has([data-testid="arquivo"])').getByLabel('enviada')).toBeVisible({ timeout: 30_000 });
	await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

	expect(await joao.page.evaluate(() => (window as unknown as { maxArquivos: number }).maxArquivos)).toBe(1);
});
