// Proteção da conta pelo arquivo ou cartão (RF-09 a, ADR-0009 D2) e pelo gerenciador de senhas (RF-09 b, D1): guardar
// sem copiar à mão e restaurar pelo link, pelo arquivo ou pela frase salva. O menu de compartilhar do sistema não existe no Chrome da suíte: o teste o simula.
import type { Page } from '@playwright/test';
import { abrirAjustes, digitarPin, expect, meuConvite, noInicio, PIN, test } from '../ajudantes.ts';

type Janela = Window & { arquivo?: { nome: string; texto: string }; impresso?: boolean };

/**
 * O menu de compartilhar: `ok` guarda o arquivo recebido, `cancelar` age como quem fechou o menu, `erro` como o
 * navegador que recusa, `pendente` como o menu que nunca abre nem termina. Antes de a tela do arquivo montar.
 */
const simularCompartilhar = (page: Page, jeito: 'ok' | 'cancelar' | 'erro' | 'pendente') =>
	page.evaluate((jeito) => {
		const w = window as Janela;
		Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
		Object.defineProperty(navigator, 'share', {
			configurable: true,
			value: async ({ files }: { files: File[] }) => {
				if (jeito === 'cancelar') throw new DOMException('cancelado', 'AbortError');
				if (jeito === 'erro') throw new DOMException('recusado', 'NotAllowedError');
				if (jeito === 'pendente') return new Promise(() => {});
				w.arquivo = { nome: files[0]!.name, texto: await files[0]!.text() };
			}
		});
	}, jeito);

const palavrasDo = (texto: string) => [...texto.matchAll(/^\d+\. (\p{L}+)$/gmu)].map(([, p]) => p!);

/** Termina a restauração aberta (pelo link ou pelo arquivo): o PIN novo duas vezes. */
async function criarPinERecuperar(page: Page, pin = '246810') {
	await digitarPin(page, 'pin', pin);
	await page.keyboard.type(pin);
	await page.getByRole('button', { name: 'Recuperar conta' }).click();
	await noInicio(page);
}

test('primeiro contato: o arquivo protege a conta, e o link dele restaura em outro aparelho', async ({ novaPessoa, novoAparelho }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await abrirAjustes(joao.page);
	const chave = await joao.page.locator('.key').textContent();
	await expect(joao.page.getByRole('link', { name: /Proteção da conta · falta proteger/ })).toBeVisible();

	await joao.page.goto(await meuConvite(maria.page));
	await joao.page.getByRole('button', { name: 'Adicionar' }).click();
	await expect(joao.page.getByRole('heading', { name: 'Guarde seu código de recuperação' })).toBeVisible();
	await joao.page.getByRole('button', { name: 'Guardar agora' }).click();
	await simularCompartilhar(joao.page, 'ok');
	await digitarPin(joao.page, 'pin', PIN);
	await joao.page.getByRole('button', { name: 'Mandar para o Drive ou outro app' }).click({ timeout: 20_000 });

	// o arquivo se explica sozinho: o aviso, o link e as 12 palavras
	await joao.page.getByRole('button', { name: 'Guardei o arquivo' }).waitFor();
	const arquivo = (await joao.page.evaluate(() => (window as Janela).arquivo))!;
	expect(arquivo.nome).toBe('lerolero-codigo-de-recuperacao.txt');
	expect(arquivo.texto).toContain('CONTA DE João');
	expect(arquivo.texto).toContain('NÃO MANDE ESTE ARQUIVO PARA NINGUÉM');
	const palavras = palavrasDo(arquivo.texto);
	expect(palavras).toHaveLength(12);
	const link = arquivo.texto.match(/^http\S+\/restaurar#\S+$/m)![0];
	expect(link).toContain('#' + palavras.join('-'));

	// "Guardei o arquivo" protege: segue para o contato, sem o aviso no início
	await joao.page.getByRole('button', { name: 'Guardei o arquivo' }).click();
	await expect(joao.page.getByRole('heading', { name: 'Maria' })).toBeVisible();
	await joao.page.goto('./');
	await noInicio(joao.page);
	await expect(joao.page.getByText('Você ainda não guardou seu código de recuperação.')).toHaveCount(0);
	await abrirAjustes(joao.page);
	await expect(joao.page.getByRole('link', { name: /Proteção da conta · protegida/ })).toBeVisible();

	// o link do arquivo num aparelho novo: as palavras chegam prontas e saem do endereço
	const outro = await novoAparelho();
	await outro.goto(link);
	await expect(outro.getByText('As palavras do seu código de recuperação já estão aqui.', { exact: false })).toBeVisible({ timeout: 20_000 });
	await expect(outro.locator('#frase')).toHaveValue(palavras.join(' '));
	expect(new URL(outro.url()).hash).toBe('');
	await criarPinERecuperar(outro);
	await abrirAjustes(outro);
	await expect(outro.locator('.key')).toHaveText(chave!);
});

test('Proteção da conta: cancelar não protege; o cartão sai na impressão; o arquivo baixado restaura', async ({ novaPessoa, novoAparelho }) => {
	const { page } = await novaPessoa('Maria');
	await abrirAjustes(page);
	const chave = await page.locator('.key').textContent();
	await page.getByRole('link', { name: /Proteção da conta/ }).click();
	await expect(page.getByText('Falta proteger.', { exact: false })).toBeVisible();
	await simularCompartilhar(page, 'cancelar');
	await digitarPin(page, 'pin', PIN);

	// fechou o menu de compartilhar: nada foi guardado, e não é erro
	await page.getByRole('button', { name: 'Mandar para o Drive ou outro app' }).click({ timeout: 20_000 });
	await page.waitForTimeout(300);
	await expect(page.getByRole('button', { name: 'Guardei o arquivo' })).toHaveCount(0);
	await expect(page.getByRole('alert')).toHaveCount(0);

	// o navegador recusou o compartilhar: diz por quê, em vez de não fazer nada (bug visto no Motorola, 2026-10-29)
	await simularCompartilhar(page, 'erro');
	await page.getByRole('button', { name: 'Mandar para o Drive ou outro app' }).click();
	await expect(page.getByRole('alert')).toContainText('NotAllowedError');
	await expect(page.getByRole('button', { name: 'Guardei o arquivo' })).toHaveCount(0);

	// o cartão: só ele aparece na impressão, com as palavras e o QR
	await page.evaluate(() => (window.print = () => void ((window as Janela).impresso = true)));
	await page.getByRole('button', { name: 'Imprimir o cartão' }).click();
	expect(await page.evaluate(() => (window as Janela).impresso)).toBe(true);
	await expect(page.locator('.print-card')).toBeHidden();
	await page.emulateMedia({ media: 'print' });
	await expect(page.locator('.print-card')).toBeVisible();
	await expect(page.locator('.print-card li')).toHaveCount(12);
	await expect(page.locator('.print-card .qr svg')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Salvar o arquivo' })).toBeHidden();
	await page.emulateMedia({ media: 'screen' });

	// o menu que não abre nem termina: um segundo toque não chama o navegador de novo (que daria InvalidStateError)
	await simularCompartilhar(page, 'pendente');
	await page.getByRole('button', { name: 'Mandar para o Drive ou outro app' }).click();
	await expect(page.getByRole('button', { name: 'Mandar para o Drive ou outro app' })).toBeDisabled();

	// salvar no celular baixa o arquivo, com ou sem o menu de compartilhar
	const baixado = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Salvar no celular' }).click();
	const download = await baixado;
	expect(download.suggestedFilename()).toBe('lerolero-codigo-de-recuperacao.txt');
	const caminho = await download.path();
	await page.getByRole('button', { name: 'Guardei o arquivo' }).click();
	await expect(page.getByText('Pronto, conta protegida.', { exact: false })).toBeVisible();
	await page.reload();
	await expect(page.getByText('Conta protegida.', { exact: false })).toBeVisible({ timeout: 20_000 });

	// "Já tenho uma conta" no aparelho novo: um arquivo qualquer avisa; o de recuperação preenche as palavras
	const outro = await novoAparelho();
	await outro.goto('./');
	await outro.getByRole('link', { name: 'Já tenho uma conta' }).or(outro.getByRole('button', { name: 'Já tenho uma conta' })).click();
	const escolher = async (arquivo: string | { name: string; mimeType: string; buffer: Buffer }) => {
		const seletor = outro.waitForEvent('filechooser');
		await outro.getByRole('button', { name: 'Abrir o arquivo de recuperação' }).click();
		await (await seletor).setFiles(arquivo);
	};
	await escolher({ name: 'compras.txt', mimeType: 'text/plain', buffer: Buffer.from('arroz\nfeijão\n') });
	await expect(outro.getByText('Não achei as 12 palavras neste arquivo.', { exact: false })).toBeVisible();
	await escolher(caminho);
	await expect(outro.locator('#frase')).toHaveValue(/^(\p{L}+ ){11}\p{L}+$/u);
	await expect(outro.getByText('Não achei as 12 palavras neste arquivo.', { exact: false })).toHaveCount(0);
	await criarPinERecuperar(outro);
	await abrirAjustes(outro);
	await expect(outro.locator('.key')).toHaveText(chave!);
});

type Guardado = { id: string; password: string; name?: string };
type ComCredencial = Window & { guardado?: Guardado };

/** O gerenciador de senhas do Chrome: `store` guarda o que recebeu; `get` devolve a frase dada (ou nada). */
const simularGerenciador = (page: Page, frase?: string) =>
	page.addInitScript((frase) => {
		Object.defineProperty(navigator.credentials, 'store', {
			configurable: true,
			value: async (c: Guardado) => void ((window as ComCredencial).guardado = { id: c.id, password: c.password, name: c.name })
		});
		Object.defineProperty(navigator.credentials, 'get', {
			configurable: true,
			value: async () => (frase ? { id: 'Maria · Lero-lero', type: 'password', password: frase } : null)
		});
	}, frase);

test('gerenciador de senhas: guardar protege a conta, e a frase salva restaura em outro aparelho', async ({ novaPessoa, novoAparelho }) => {
	const { page } = await novaPessoa('Maria');
	// o script só vale a partir da próxima página carregada
	await simularGerenciador(page);
	await page.goto('./');
	await noInicio(page);
	await abrirAjustes(page);
	const chave = await page.locator('.key').textContent();
	await page.getByRole('link', { name: /Proteção da conta/ }).click();
	await digitarPin(page, 'pin', PIN);
	await page.getByRole('button', { name: 'Guardar no gerenciador de senhas' }).click({ timeout: 20_000 });

	// o app pede ao navegador para salvar, pelo PasswordCredential, com um nome legível e as 12 palavras
	const guardado = (await page.evaluate(() => (window as ComCredencial).guardado))!;
	expect(guardado.id).toBe('Maria · Lero-lero');
	expect(guardado.password).toMatch(/^(\p{L}+ ){11}\p{L}+$/u);

	// sem saber se a pessoa aceitou, só protege quando ela confirma; "Não apareceu nada" volta ao botão
	await expect(page.getByRole('button', { name: 'Salvei no gerenciador' })).toBeVisible();
	await page.getByRole('button', { name: 'Não apareceu nada' }).click();
	await page.getByRole('button', { name: 'Guardar no gerenciador de senhas' }).click();
	await page.getByRole('button', { name: 'Salvei no gerenciador' }).click();
	await expect(page.getByText('Pronto, conta protegida.', { exact: false })).toBeVisible();
	await page.reload();
	await expect(page.getByText('Conta protegida.', { exact: false })).toBeVisible({ timeout: 20_000 });

	// aparelho novo sem nada salvo: avisa e deixa os outros caminhos
	const vazio = await novoAparelho();
	await simularGerenciador(vazio);
	await vazio.goto('./restaurar');
	await vazio.getByRole('button', { name: 'Usar o código salvo no navegador' }).click();
	await expect(vazio.getByText('Não achei um código salvo neste navegador.', { exact: false })).toBeVisible();

	// aparelho novo com a frase sincronizada pela conta Google: ela chega pronta, falta o PIN
	const outro = await novoAparelho();
	await simularGerenciador(outro, guardado.password);
	await outro.goto('./restaurar');
	await outro.getByRole('button', { name: 'Usar o código salvo no navegador' }).click();
	await expect(outro.locator('#frase')).toHaveValue(guardado.password);
	await criarPinERecuperar(outro);
	await abrirAjustes(outro);
	await expect(outro.locator('.key')).toHaveText(chave!);
});

test('gerenciador de senhas sem PasswordCredential: o formulário é enviado e some, e a restauração não oferece o botão', async ({ novaPessoa, novoAparelho }) => {
	const { page } = await novaPessoa('Maria');
	await page.addInitScript(() => delete (window as { PasswordCredential?: unknown }).PasswordCredential);
	await page.goto('./ajustes/protecao');
	await digitarPin(page, 'pin', PIN);

	// os campos que o navegador reconhece: nome da conta e a frase num campo de senha nova
	await expect(page.locator('#senha-conta')).toHaveValue('Maria · Lero-lero', { timeout: 20_000 });
	await expect(page.locator('#senha-conta')).toHaveAttribute('autocomplete', 'username');
	await expect(page.locator('#senha-codigo')).toHaveAttribute('autocomplete', 'new-password');
	await expect(page.locator('#senha-codigo')).toHaveValue(/^(\p{L}+ ){11}\p{L}+$/u);
	await page.getByRole('button', { name: 'Guardar no gerenciador de senhas' }).click();
	await expect(page.locator('#senha-codigo')).toHaveCount(0);
	await page.getByRole('button', { name: 'Salvei no gerenciador' }).click();
	await expect(page.getByText('Pronto, conta protegida.', { exact: false })).toBeVisible();

	const outro = await novoAparelho();
	await outro.addInitScript(() => delete (window as { PasswordCredential?: unknown }).PasswordCredential);
	await outro.goto('./restaurar');
	await expect(outro.getByRole('button', { name: 'Abrir o arquivo de recuperação' })).toBeVisible();
	await expect(outro.getByRole('button', { name: 'Usar o código salvo no navegador' })).toHaveCount(0);
});
