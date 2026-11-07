// Cadastro, PIN e recuperação da conta (RF-01..06): o caminho de quem chega no app pela primeira vez.
import { abrirAjustes, criarConta, digitarPin, esquecerAjuste, expect, meuConvite, noInicio, PIN, recuperarConta, test, vencerSessao, verFrase } from '../ajudantes.ts';

test('cadastro: um PIN por vez; diferentes avisam e voltam ao começo, iguais criam a conta sem botão e sem a frase', async ({ novoAparelho }) => {
	const page = await novoAparelho();
	await page.goto('./');
	await expect(page).toHaveURL(/\/bem-vindo$/);
	// a moldura "Homologação" (ADR-0007) só existe no build da homologação
	await expect(page.locator('.homolog')).toHaveCount(0);
	await page.getByRole('link', { name: 'Criar minha conta' }).click();
	await expect(page.getByText('Passo 1 de 2')).toBeVisible();
	await page.locator('#nome').fill('Maria');
	await page.getByRole('button', { name: 'Continuar' }).click();

	await expect(page.getByText('Passo 2 de 2')).toBeVisible();
	await digitarPin(page, 'pin', PIN);
	// a confirmação usa o mesmo campo, que continua com o foco
	await expect(page.getByRole('heading', { name: 'Digite o PIN de novo' })).toBeVisible();
	await expect(page.locator('#pin')).toBeFocused();
	await page.keyboard.type('654321');
	await expect(page.getByText('Os dois PINs não são iguais')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Crie um PIN de 6 números' })).toBeVisible();
	await expect(page.locator('#pin')).toHaveValue('');
	await expect(page.locator('#pin')).toBeFocused();

	await page.keyboard.type(PIN);
	await page.keyboard.type(PIN);
	// a frase fica para o primeiro contato (Q-U1): sem ele, nem o aviso aparece
	await noInicio(page);
	await expect(page.getByText('Você ainda não guardou sua frase de recuperação.')).toHaveCount(0);
});

test('cadastro: a seta volta do PIN para o nome, e a foto escolhida no nome vira a do perfil', async ({ novoAparelho }) => {
	const page = await novoAparelho();
	await page.goto('./cadastro');
	const base64 = await page.evaluate(async () => {
		const canvas = document.createElement('canvas');
		canvas.width = 300;
		canvas.height = 200;
		const context = canvas.getContext('2d')!;
		context.fillStyle = '#3a3';
		context.fillRect(0, 0, 300, 200);
		const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
		let binary = '';
		for (const byte of new Uint8Array(await blob.arrayBuffer())) binary += String.fromCharCode(byte);
		return btoa(binary);
	});
	await page.getByTestId('foto-cadastro').setInputFiles({ name: 'eu.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') });
	await expect(page.getByRole('button', { name: 'Trocar foto' })).toBeVisible();
	await page.locator('#nome').fill('Bia');
	await page.getByRole('button', { name: 'Continuar' }).click();
	await page.getByRole('button', { name: 'Voltar' }).click();
	await expect(page.locator('#nome')).toHaveValue('Bia');
	await page.getByRole('button', { name: 'Continuar' }).click();
	await digitarPin(page, 'pin', PIN);
	await page.keyboard.type(PIN);
	await noInicio(page);
	// pela interface, sem recarregar: a foto sobe em segundo plano depois que a conta é criada
	await abrirAjustes(page);
	await expect(page.locator('img.avatar')).toBeVisible({ timeout: 30_000 });
});

test('o código vem com o primeiro contato: anotar as palavras confere e some; depois adia', async ({ novaPessoa }) => {
	const [maria, joao, ana] = await Promise.all([novaPessoa('Maria'), novaPessoa('João'), novaPessoa('Ana')]);

	await joao.page.goto(await meuConvite(maria.page));
	await joao.page.getByRole('button', { name: 'Adicionar' }).click();
	await expect(joao.page.getByRole('heading', { name: 'Guarde sua frase de recuperação' })).toBeVisible();
	await joao.page.getByRole('button', { name: 'Guardar agora' }).click();
	await digitarPin(joao.page, 'pin', PIN);
	// o jeito principal é o arquivo (protecao.spec.ts); anotar à mão continua possível
	await joao.page.getByRole('button', { name: 'Prefiro anotar as palavras' }).click();
	await expect(joao.page.locator('ol li')).toHaveCount(12, { timeout: 20_000 });
	const frase = (await joao.page.locator('ol li').allTextContents()).map((t) => t.replace(/^\d+/, '').trim());
	await joao.page.getByLabel('Guardei as 12 palavras').check();
	await joao.page.getByRole('button', { name: 'Continuar' }).click();
	for (const campo of await joao.page.locator('input[id^="palavra-"]').all()) {
		const posicao = Number((await campo.getAttribute('id'))!.slice('palavra-'.length));
		await campo.fill(frase[posicao]);
	}
	await joao.page.getByRole('button', { name: 'Confirmar' }).click();
	// segue para o contato que acabou de entrar, e o aviso não volta
	await expect(joao.page.getByRole('heading', { name: 'Maria' })).toBeVisible();
	await joao.page.goto('./');
	await noInicio(joao.page);
	await expect(joao.page.getByText('Você ainda não guardou sua frase de recuperação.')).toHaveCount(0);

	// "Depois" segue para o contato; a tela não aparece de novo e o aviso fica adiado
	await maria.page.goto(await meuConvite(joao.page));
	await maria.page.getByRole('button', { name: 'Adicionar' }).click();
	await maria.page.getByRole('button', { name: 'Depois' }).click();
	await expect(maria.page.getByRole('heading', { name: 'João' })).toBeVisible();
	await maria.page.goto('./');
	await noInicio(maria.page);
	await expect(maria.page.getByText('Você ainda não guardou sua frase de recuperação.')).toHaveCount(0);
	await maria.page.goto(await meuConvite(ana.page));
	await maria.page.getByRole('button', { name: 'Adicionar' }).click();
	await expect(maria.page.getByRole('heading', { name: 'Ana' })).toBeVisible();

	// passado o adiamento, o aviso aparece na tela inicial
	await esquecerAjuste(maria.page, 'lembreteFraseAdiadoAte');
	await maria.page.goto('./');
	await expect(maria.page.getByText('Você ainda não guardou sua frase de recuperação.')).toBeVisible({ timeout: 20_000 });
});

test('PIN: a sessão vencida pede o PIN; errado avisa, certo abre', async ({ novaPessoa }) => {
	const { page } = await novaPessoa('Maria');

	await vencerSessao(page);
	await page.goto('./');
	await expect(page).toHaveURL(/\/desbloquear$/, { timeout: 20_000 });
	await expect(page.getByRole('heading', { name: 'Olá, Maria' })).toBeVisible();

	await digitarPin(page, 'pin', '000000');
	await expect(page.getByText('PIN incorreto.')).toBeVisible({ timeout: 20_000 });
	await expect(page.locator('#pin')).toHaveValue('');

	await page.keyboard.type(PIN);
	await noInicio(page);
});

test('recuperar a conta com a frase em outro aparelho dá a mesma chave', async ({ novaPessoa, novoAparelho }) => {
	const maria = await novaPessoa('Maria');
	await abrirAjustes(maria.page);
	const chave = await maria.page.locator('.key').textContent();
	expect(chave).toMatch(/^npub1/);
	const frase = await verFrase(maria.page);

	const outro = await novoAparelho();
	await recuperarConta(outro, frase);
	await noInicio(outro);
	await abrirAjustes(outro);
	await expect(outro.locator('.key')).toHaveText(chave!);
});

test('recuperar e esqueci o PIN: a frase conferida antes, depois o PIN um por vez; a seta volta um passo', async ({ novaPessoa, novoAparelho }) => {
	const { page } = await novaPessoa('Maria');
	const frase = await verFrase(page);

	// recuperar: a frase errada avisa ainda no passo 1
	const outro = await novoAparelho();
	await outro.goto('./restaurar');
	await expect(outro.getByText('Passo 1 de 2')).toBeVisible();
	await outro.locator('#frase').fill(frase.slice(0, 11).join(' '));
	await outro.getByRole('button', { name: 'Continuar' }).click();
	await expect(outro.getByRole('alert')).toBeVisible();
	await expect(outro.getByText('Passo 1 de 2')).toBeVisible();

	// a certa: PIN, confirmação diferente volta ao começo; a seta da confirmação volta ao PIN e a do PIN, à frase
	await outro.locator('#frase').fill(frase.join(' '));
	await outro.getByRole('button', { name: 'Continuar' }).click();
	await expect(outro.getByText('Passo 2 de 2')).toBeVisible();
	await expect(outro.locator('#pin')).toBeFocused();
	await outro.keyboard.type(PIN);
	await expect(outro.getByRole('heading', { name: 'Digite o PIN de novo' })).toBeVisible();
	await outro.keyboard.type('654321');
	await expect(outro.getByText('Os dois PINs não são iguais')).toBeVisible();
	await expect(outro.getByRole('heading', { name: 'Crie um PIN de 6 números' })).toBeVisible();
	await outro.keyboard.type(PIN);
	await outro.getByRole('button', { name: 'Voltar' }).click();
	await expect(outro.getByRole('heading', { name: 'Crie um PIN de 6 números' })).toBeVisible();
	await outro.getByRole('button', { name: 'Voltar' }).click();
	await expect(outro.locator('#frase')).toHaveValue(frase.join(' '));
	await outro.getByRole('button', { name: 'Continuar' }).click();
	await digitarPin(outro, 'pin', PIN);
	await outro.keyboard.type(PIN);
	await noInicio(outro);

	// esqueci o PIN: a mesma sequência, e o PIN novo abre o app
	await vencerSessao(page);
	await page.goto('./');
	await expect(page).toHaveURL(/\/desbloquear$/, { timeout: 20_000 });
	await page.locator('a.forgot').click();
	await expect(page.getByText('Passo 1 de 2')).toBeVisible();
	await page.locator('#frase').fill(frase.join(' '));
	await page.getByRole('button', { name: 'Continuar' }).click();
	await expect(page.getByRole('heading', { name: 'Crie um PIN novo' })).toBeVisible();
	await digitarPin(page, 'pin', '246810');
	await expect(page.getByRole('heading', { name: 'Digite o PIN novo de novo' })).toBeVisible();
	await page.keyboard.type('246810');
	await noInicio(page);
});

test('armazenamento persistente (T19): pede ao entrar, tenta de novo só depois de um dia e para quando concedido', async ({ novoAparelho }) => {
	const page = await novoAparelho();
	// o Chrome nega no cadastro; o teste conta os pedidos e controla a resposta
	await page.addInitScript(() => {
		const contar = () => Number(localStorage.getItem('pedidosPersist') ?? 0);
		Object.defineProperty(navigator, 'storage', {
			value: {
				persisted: async () => localStorage.getItem('concedido') === 'sim',
				persist: async () => {
					localStorage.setItem('pedidosPersist', String(contar() + 1));
					return localStorage.getItem('concedido') === 'sim';
				}
			}
		});
	});
	const pedidos = () => page.evaluate(() => Number(localStorage.getItem('pedidosPersist') ?? 0));
	await criarConta(page, 'Maria');
	await expect.poll(pedidos).toBe(1);

	// recarregar no mesmo dia não insiste
	await page.reload();
	await noInicio(page);
	await page.waitForTimeout(500);
	expect(await pedidos()).toBe(1);

	// passado o dia, tenta de novo; concedido, não pergunta mais
	await esquecerAjuste(page, 'armazenamentoPersistenteTentadoEm');
	await page.reload();
	await expect.poll(pedidos).toBe(2);
	await page.evaluate(() => localStorage.setItem('concedido', 'sim'));
	await esquecerAjuste(page, 'armazenamentoPersistenteTentadoEm');
	await page.reload();
	await noInicio(page);
	await page.waitForTimeout(500);
	expect(await pedidos()).toBe(2);
});
