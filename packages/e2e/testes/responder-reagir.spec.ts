// Responder (RF-22) e reagir (RF-23): pelo menu da mensagem; a citação aparece nas duas pontas e cada pessoa tem uma
// reação por mensagem.
import { abrirConversaQuandoChegar, adicionarUmAoOutro, enviarTexto, expect, test, type Pessoa } from '../ajudantes.ts';

const menu = (p: Pessoa) => p.page.getByRole('dialog', { name: 'Opções da mensagem' });

test('Maria responde a João citando a mensagem, e os dois reagem', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await adicionarUmAoOutro(maria, joao);

	await enviarTexto(joao.page, 'vamos jantar?');
	await abrirConversaQuandoChegar(maria.page, 'João');
	const doJoao = maria.page.locator('.row:not(.mine)', { hasText: 'vamos jantar?' });
	await expect(doJoao).toBeVisible({ timeout: 30_000 });

	// responder: a faixa do campo mostra a quem, e o balão sai com a citação
	await doJoao.locator('.bubble').click({ button: 'right' });
	await menu(maria).getByRole('button', { name: 'Responder' }).click();
	await expect(maria.page.getByText('Respondendo a João')).toBeVisible();
	await maria.page.getByLabel('Mensagem').fill('vamos!');
	await maria.page.getByRole('button', { name: 'Enviar', exact: true }).click();
	await expect(maria.page.getByText('Respondendo a João')).toBeHidden();
	const resposta = maria.page.locator('.row.mine', { hasText: 'vamos!' });
	await expect(resposta.locator('.quote')).toContainText('João');
	await expect(resposta.locator('.quote')).toContainText('vamos jantar?');

	// do outro lado a citação é "Você"
	const naTelaDoJoao = joao.page.locator('.row:not(.mine)', { hasText: 'vamos!' });
	await expect(naTelaDoJoao.locator('.quote')).toContainText('Você', { timeout: 30_000 });
	await expect(naTelaDoJoao.locator('.quote')).toContainText('vamos jantar?');

	// reação de Maria à mensagem de João
	await doJoao.locator('.bubble').click({ button: 'right' });
	await menu(maria).getByRole('button', { name: 'Reagir com 👍' }).click();
	await expect(doJoao.getByRole('button', { name: 'Reação 👍: 1' })).toBeVisible();
	const daMaria = joao.page.locator('.row.mine', { hasText: 'vamos jantar?' });
	await expect(daMaria.getByRole('button', { name: 'Reação 👍: 1' })).toBeVisible({ timeout: 30_000 });

	// o "+" abre o seletor completo, com muito mais emojis que os seis principais
	await doJoao.locator('.bubble').click({ button: 'right' });
	await menu(maria).getByRole('button', { name: 'Mais reações' }).click();
	expect(await menu(maria).locator('.emoji').count()).toBeGreaterThan(40);
	await menu(maria).getByRole('button', { name: 'Reagir com 🎉' }).click();
	await expect(doJoao.getByRole('button', { name: 'Reação 🎉: 1' })).toBeVisible();
	await expect(doJoao.getByRole('button', { name: /Reação 👍/ })).toHaveCount(0);
	await expect(daMaria.getByRole('button', { name: 'Reação 🎉: 1' })).toBeVisible({ timeout: 30_000 });

	// trocar de emoji substitui a anterior
	await doJoao.locator('.bubble').click({ button: 'right' });
	await menu(maria).getByRole('button', { name: 'Reagir com ❤️' }).click();
	await expect(doJoao.getByRole('button', { name: 'Reação ❤️: 1' })).toBeVisible();
	await expect(doJoao.getByRole('button', { name: /Reação 🎉/ })).toHaveCount(0);
	await expect(daMaria.getByRole('button', { name: 'Reação ❤️: 1' })).toBeVisible({ timeout: 30_000 });
	await expect(daMaria.getByRole('button', { name: /Reação 🎉/ })).toHaveCount(0);

	// João reage com o mesmo ❤️ (toque no chip): soma 2; tocar de novo desfaz só a dele
	await daMaria.getByRole('button', { name: 'Reação ❤️: 1' }).click();
	await expect(daMaria.getByRole('button', { name: 'Reação ❤️: 2' })).toBeVisible();
	await expect(doJoao.getByRole('button', { name: 'Reação ❤️: 2' })).toBeVisible({ timeout: 30_000 });
	await daMaria.getByRole('button', { name: 'Reação ❤️: 2' }).click();
	await expect(daMaria.getByRole('button', { name: 'Reação ❤️: 1' })).toBeVisible();
	await expect(doJoao.getByRole('button', { name: 'Reação ❤️: 1' })).toBeVisible({ timeout: 30_000 });

	// Maria desfaz a dela (mesmo emoji pelo menu): some nos dois
	await doJoao.locator('.bubble').click({ button: 'right' });
	await menu(maria).getByRole('button', { name: 'Reagir com ❤️' }).click();
	await expect(doJoao.locator('.chip')).toHaveCount(0);
	await expect(daMaria.locator('.chip')).toHaveCount(0, { timeout: 30_000 });
});

test('a citação sobrevive a recarregar e a mensagem original apagada vira aviso', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await adicionarUmAoOutro(maria, joao);

	await enviarTexto(joao.page, 'combinado às oito');
	await abrirConversaQuandoChegar(maria.page, 'João');
	const original = maria.page.locator('.row:not(.mine)', { hasText: 'combinado às oito' });
	await expect(original).toBeVisible({ timeout: 30_000 });
	await original.locator('.bubble').click({ button: 'right' });
	await menu(maria).getByRole('button', { name: 'Responder' }).click();
	await maria.page.getByLabel('Mensagem').fill('fechado');
	await maria.page.getByRole('button', { name: 'Enviar', exact: true }).click();
	await expect(maria.page.locator('.row.mine', { hasText: 'fechado' }).locator('.quote')).toContainText('combinado às oito');

	await maria.page.reload();
	await expect(maria.page.locator('.row.mine', { hasText: 'fechado' }).locator('.quote')).toContainText('combinado às oito');

	// João apaga a original para todos: a citação mostra que foi apagada
	await joao.page.locator('.row.mine', { hasText: 'combinado às oito' }).locator('.bubble').click({ button: 'right' });
	await menu(joao).getByRole('button', { name: 'Apagar para todos' }).click();
	await menu(joao).getByRole('button', { name: 'Apagar para todos' }).click();
	await expect(maria.page.locator('.row.mine', { hasText: 'fechado' }).locator('.quote')).toContainText('Mensagem apagada', { timeout: 30_000 });
});
