// Cadastro, PIN e recuperação da conta (RF-01..06): o caminho de quem chega no app pela primeira vez.
import { digitarPin, expect, noInicio, PIN, test, vencerSessao } from '../ajudantes.ts';

test('cadastro: PINs diferentes avisam, iguais criam a conta sem tocar em botão', async ({ novoAparelho }) => {
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
	await expect(page.getByRole('heading', { name: 'Sua frase de recuperação' })).toBeVisible({ timeout: 20_000 });
	await expect(page.locator('ol li')).toHaveCount(12);
});

test('PIN: a sessão vencida pede o PIN; errado avisa, certo abre', async ({ novaPessoa }) => {
	const { page } = await novaPessoa('Maria');
	await expect(page.getByText('Você ainda não conferiu sua frase de recuperação.')).toBeVisible();

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

	const outro = await novoAparelho();
	await outro.goto('./');
	await outro.getByRole('link', { name: 'Já tenho uma conta' }).or(outro.getByRole('button', { name: 'Já tenho uma conta' })).click();
	await outro.locator('#frase').fill(maria.frase.join(' '));
	await outro.locator('#nome').fill('Maria');
	await digitarPin(outro, 'pin', '246810');
	await outro.keyboard.type('246810');
	await outro.getByRole('button', { name: 'Recuperar conta' }).click();
	await noInicio(outro);
	await outro.getByRole('link', { name: 'Ajustes' }).click();
	await expect(outro.locator('.key')).toHaveText(chave!);
});
