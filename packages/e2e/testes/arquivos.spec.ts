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
