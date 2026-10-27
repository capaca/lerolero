// Cadastro, PIN e recuperação da conta (RF-01..06): o caminho de quem chega no app pela primeira vez.
import { criarConta, digitarPin, esquecerAjuste, expect, meuConvite, noInicio, PIN, test, vencerSessao, verFrase } from '../ajudantes.ts';

test('cadastro: PINs diferentes avisam, iguais criam a conta sem tocar em botão e sem pedir a frase', async ({ novoAparelho }) => {
	const page = await novoAparelho();
	await page.goto('./');
	await expect(page).toHaveURL(/\/bem-vindo$/);
	// a moldura "Homologação" (ADR-0007) só existe no build da homologação
	await expect(page.locator('.homolog')).toHaveCount(0);
	await page.getByRole('link', { name: 'Criar minha conta' }).or(page.getByRole('button', { name: 'Criar minha conta' })).click();
	await page.locator('#nome').fill('Maria');
	await page.getByRole('button', { name: 'Continuar' }).click();

	await digitarPin(page, 'pin', PIN);
	await expect(page.locator('#pin2')).toBeFocused();
	await page.keyboard.type('654321');
	await expect(page.getByText('Os dois PINs não são iguais')).toBeVisible();
	await expect(page.locator('#pin2')).toHaveValue('');
	await expect(page.locator('#pin2')).toBeFocused();

	await page.keyboard.type(PIN);
	// a frase fica para o primeiro contato (Q-U1): sem ele, nem o aviso aparece
	await noInicio(page);
	await expect(page.getByText('Você ainda não guardou sua frase de recuperação.')).toHaveCount(0);
});

test('a frase vem com o primeiro contato: guardar agora confere e some; depois adia', async ({ novaPessoa }) => {
	const [maria, joao, ana] = await Promise.all([novaPessoa('Maria'), novaPessoa('João'), novaPessoa('Ana')]);

	await joao.page.goto(await meuConvite(maria.page));
	await joao.page.getByRole('button', { name: 'Adicionar' }).click();
	await expect(joao.page.getByRole('heading', { name: 'Guarde sua frase de recuperação' })).toBeVisible();
	await joao.page.getByRole('button', { name: 'Guardar agora' }).click();
	await digitarPin(joao.page, 'pin', PIN);
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
	await maria.page.getByRole('link', { name: 'Ajustes' }).click();
	const chave = await maria.page.locator('.key').textContent();
	expect(chave).toMatch(/^npub1/);
	const frase = await verFrase(maria.page);

	const outro = await novoAparelho();
	await outro.goto('./');
	await outro.getByRole('link', { name: 'Já tenho uma conta' }).or(outro.getByRole('button', { name: 'Já tenho uma conta' })).click();
	await outro.locator('#frase').fill(frase.join(' '));
	await outro.locator('#nome').fill('Maria');
	await digitarPin(outro, 'pin', '246810');
	await outro.keyboard.type('246810');
	await outro.getByRole('button', { name: 'Recuperar conta' }).click();
	await noInicio(outro);
	await outro.getByRole('link', { name: 'Ajustes' }).click();
	await expect(outro.locator('.key')).toHaveText(chave!);
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
