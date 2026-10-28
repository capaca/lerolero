// Grupos (RF-30..34): criar, conversar, e a gestão com quatro pessoas: detalhes, renomear, adicionar, promover,
// remover, sair e a herança do título de criador.
import type { Page } from '@playwright/test';
import { adicionarUmAoOutro, enviarTexto, expect, test } from '../ajudantes.ts';

async function abrirGrupo(page: Page, nome: string) {
	await page.goto('./');
	await page.locator('.conversations a', { hasText: nome }).click();
	await expect(page).toHaveURL(/\/grupo\/[^/]+$/);
}

async function abrirDetalhes(page: Page) {
	await page.locator('header a.who').click();
	await expect(page).toHaveURL(/\/detalhes$/);
}

/** Papéis na lista dos detalhes: ["Você:Criador", "Bia:", ...] */
const papeis = (page: Page) =>
	page.locator('.list li button.row').evaluateAll((rows) => rows.map((r) => `${r.querySelector('.text')!.textContent}:${r.querySelector('.role')?.textContent ?? ''}`));

/** Abre o menu de um participante e devolve as opções. */
async function menuDe(page: Page, nome: string) {
	await page.locator('.list button.row', { hasText: nome }).click();
	return (await page.getByRole('dialog').locator('.item').allTextContents()).map((t) => t.trim());
}

test('Ana cria o grupo e gerencia: renomear, adicionar, promover, remover e sair', async ({ novaPessoa }) => {
	const [ana, bia, caio, davi] = await Promise.all(['Ana', 'Bia', 'Caio', 'Davi'].map(novaPessoa));
	// contatos de verdade dos dois lados: quem não tem a Ana nos contatos recebe o grupo como pedido (RF-12)
	for (const p of [bia, caio, davi]) await adicionarUmAoOutro(p, ana);

	await ana.page.goto('./grupo/novo');
	await ana.page.locator('#nome').fill('Amigos');
	for (const n of ['Bia', 'Caio']) await ana.page.locator('.person', { hasText: n }).click();
	await expect(ana.page.getByText('2 de 19')).toBeVisible();
	await ana.page.getByRole('button', { name: 'Criar grupo' }).click();
	await expect(ana.page.locator('.notice-line', { hasText: 'Você criou o grupo “Amigos”' })).toBeVisible();

	// conversa: quem não é contato aparece com "~" e o nome que escolheu
	await enviarTexto(ana.page, 'Oi, pessoal!');
	await abrirGrupo(caio.page, 'Amigos');
	await expect(caio.page.getByText('Oi, pessoal!')).toBeVisible();
	await enviarTexto(caio.page, 'Oi, Ana!');
	await expect(ana.page.locator('.row:not(.mine)', { hasText: 'Oi, Ana!' }).locator('.sender')).toHaveText('Caio');
	await abrirGrupo(bia.page, 'Amigos');
	await expect(bia.page.locator('.row', { hasText: 'Oi, Ana!' }).locator('.sender')).toHaveText('~Caio');

	// detalhes ao tocar no nome, com o lápis para a criadora
	await abrirDetalhes(ana.page);
	await expect(ana.page.getByText('Grupo · 3 pessoas')).toBeVisible();
	expect(await papeis(ana.page)).toEqual(['Você:Criador', 'Bia:', 'Caio:']);

	await ana.page.getByRole('button', { name: 'Mudar o nome do grupo' }).click();
	await ana.page.locator('.rename #nome').fill('Amigos de sempre');
	await ana.page.getByRole('button', { name: 'Salvar' }).click();
	await expect(ana.page.getByRole('heading', { name: 'Amigos de sempre' })).toBeVisible();

	// adicionar mostra só quem está fora e quantos ainda cabem
	await ana.page.getByRole('link', { name: 'Adicionar pessoas' }).click();
	await expect(ana.page.getByText('Cabem mais 17 pessoas no grupo.')).toBeVisible();
	await expect(ana.page.locator('.person .text')).toHaveText(['Davi']);
	await ana.page.locator('.person', { hasText: 'Davi' }).click();
	await ana.page.getByRole('button', { name: 'Adicionar' }).click();
	await expect(ana.page.getByText('Grupo · 4 pessoas')).toBeVisible();

	expect(await menuDe(ana.page, 'Bia')).toEqual(['Conversar', 'Tornar administrador', 'Remover do grupo', 'Cancelar']);
	await ana.page.getByRole('button', { name: 'Tornar administrador' }).click();
	await expect(ana.page.locator('.list button.row', { hasText: 'Bia' }).locator('.role')).toHaveText('Administrador');

	// Davi, que entrou depois, recebe o grupo já renomeado
	await abrirGrupo(davi.page, 'Amigos de sempre');
	await expect(davi.page.locator('.notice-line', { hasText: 'Ana adicionou você' })).toBeVisible();

	// Caio, membro comum: vê tudo, não mexe em nada
	await abrirGrupo(caio.page, 'Amigos de sempre');
	await expect(caio.page.locator('.notice-line', { hasText: 'Ana deu a ~Bia a função de administrador' })).toBeVisible();
	await abrirDetalhes(caio.page);
	await expect(caio.page.getByText('Grupo · 4 pessoas')).toBeVisible();
	await expect(caio.page.getByRole('link', { name: 'Adicionar pessoas' })).toHaveCount(0);
	await expect(caio.page.getByRole('button', { name: 'Mudar o nome do grupo' })).toHaveCount(0);
	expect(await menuDe(caio.page, 'Bia')).toEqual(['Conversar', 'Cancelar']);
	await caio.page.getByRole('button', { name: 'Cancelar' }).click();

	// Bia, administradora: remove o Caio, mas não mexe na criadora
	await abrirGrupo(bia.page, 'Amigos de sempre');
	await abrirDetalhes(bia.page);
	await expect(bia.page.getByText('Grupo · 4 pessoas')).toBeVisible();
	expect((await papeis(bia.page)).slice(0, 2)).toEqual(['Você:Administrador', 'Ana:Criador']);
	expect(await menuDe(bia.page, 'Ana')).toEqual(['Conversar', 'Cancelar']);
	await bia.page.getByRole('button', { name: 'Cancelar' }).click();
	expect(await menuDe(bia.page, 'Caio')).toEqual(['Conversar', 'Tornar administrador', 'Remover do grupo', 'Cancelar']);
	await bia.page.getByRole('button', { name: 'Remover do grupo' }).click();
	await expect(bia.page.getByText('Remover ~Caio do grupo?')).toBeVisible();
	await bia.page.getByRole('button', { name: 'Remover', exact: true }).click();
	await expect(bia.page.getByText('Grupo · 3 pessoas')).toBeVisible();

	// Caio fica sabendo sem recarregar
	await expect(caio.page.getByText('Você não faz mais parte deste grupo.')).toBeVisible();
	await expect(caio.page.getByRole('button', { name: 'Sair do grupo' })).toHaveCount(0);

	// Ana sai: o título de criador vai para a Bia
	await ana.page.getByRole('button', { name: 'Sair do grupo' }).click();
	await expect(ana.page.getByText('Bia passa a ser o criador')).toBeVisible();
	await ana.page.getByRole('dialog').getByRole('button', { name: 'Sair do grupo' }).click();
	await expect(ana.page).toHaveURL(/\/grupo\/[^/]+$/);
	await expect(ana.page.getByText('Você não faz mais parte deste grupo.')).toBeVisible();
	await expect(ana.page.getByLabel('Mensagem')).toHaveCount(0);

	await expect(bia.page.locator('.list button.row', { hasText: 'Você' }).locator('.role')).toHaveText('Criador');
});
