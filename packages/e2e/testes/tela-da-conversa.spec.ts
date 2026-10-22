// Tela da conversa sem depender de entrega: as mensagens do contato entram direto no IndexedDB.
import type { Page } from '@playwright/test';
import { expect, test } from '../ajudantes.ts';

const OUTRO = 'ab'.repeat(32);

async function enviar(page: Page, texto: string) {
	await page.getByLabel('Mensagem').fill(texto);
	await page.getByRole('button', { name: 'Enviar', exact: true }).click();
	await expect(page.locator('.row', { hasText: texto })).toBeVisible();
}

/** Grava mensagens do contato no aparelho, como se tivessem chegado: [id, texto, segundos]. */
const receber = (page: Page, lista: [string, string, number][]) =>
	page.evaluate(
		({ lista, outro }) =>
			new Promise<void>((ok, falha) => {
				const req = indexedDB.open('lerolero');
				req.onerror = () => falha(req.error);
				req.onsuccess = () => {
					const tx = req.result.transaction('messages', 'readwrite');
					for (const [id, text, createdAt] of lista) {
						tx.objectStore('messages').put({ id, conversationId: 'direta:' + outro, sender: outro, kind: 14, text, createdAt, status: 'recebida' });
					}
					tx.oncomplete = () => ok();
				};
			}),
		{ lista, outro: OUTRO }
	);

test('balões da mesma pessoa se agrupam, com a pontinha só no último, na ordem do envio', async ({ novaPessoa }) => {
	const { page } = await novaPessoa('Maria');
	await page.goto(`./conversa/${OUTRO}`);
	const agora = Math.floor(Date.now() / 1000);
	await receber(page, [
		['r1', 'Oi Maria!', agora - 300],
		['r2', 'Tudo bem por aí?', agora - 290],
		['r3', 'Tô chegando, devo levar alguma coisa?', agora - 280]
	]);
	// regressão (2026-10-22): mensagens mandadas no mesmo segundo apareciam trocadas
	for (const t of ['Oi!', 'Tudo ótimo', 'Pode trazer o bolo']) await enviar(page, t);
	await receber(page, [['r4', 'Combinado', agora + 60]]);
	await enviar(page, 'Até já');

	const linhas = page.locator('.row');
	await expect(linhas).toHaveCount(8);
	const balões = await linhas.evaluateAll((rows) =>
		rows.map((r) => ({
			texto: r.querySelector('p')?.textContent ?? '',
			marca: (r.classList.contains('first') ? 'F' : '-') + (r.classList.contains('last') ? 'L' : '-'),
			pontinha: !!r.querySelector('.tail')
		}))
	);
	expect(balões.map((b) => b.texto)).toEqual([
		'Oi Maria!',
		'Tudo bem por aí?',
		'Tô chegando, devo levar alguma coisa?',
		'Oi!',
		'Tudo ótimo',
		'Pode trazer o bolo',
		'Até já',
		'Combinado'
	]);
	expect(balões.map((b) => b.marca).join(' ')).toBe('F- -- -L F- -- -- -L FL');
	expect(balões.every((b) => b.pontinha === b.marca.endsWith('L'))).toBe(true);
});

// regressão (2026-10-22): com o teclado aberto, as mensagens saíam de vista. Com
// interactive-widget=resizes-content o teclado encolhe a página; encolher a janela simula o mesmo.
test('com o teclado aberto, a última mensagem continua junto do campo', async ({ novaPessoa }) => {
	const { page } = await novaPessoa('Maria');
	await expect(page.locator('meta[name=viewport]')).toHaveAttribute('content', /interactive-widget=resizes-content/);
	await page.goto(`./conversa/${OUTRO}`);

	const ultima = () =>
		page.evaluate(() => {
			const rows = document.querySelectorAll('.row');
			const last = rows[rows.length - 1].getBoundingClientRect();
			const area = document.querySelector('.messages')!.getBoundingClientRect();
			const campo = document.querySelector('.composer')!.getBoundingClientRect();
			return { visivel: last.top >= area.top && last.bottom <= area.bottom, folga: Math.round(campo.top - last.bottom) };
		});
	const juntoDoCampo = async () => {
		await expect.poll(ultima).toMatchObject({ visivel: true });
		expect((await ultima()).folga).toBeLessThan(30);
	};

	for (const t of ['Oi', 'Tudo bem?', 'Chegou?']) await enviar(page, t);
	await juntoDoCampo();

	await page.getByLabel('Mensagem').focus();
	await page.setViewportSize({ width: 400, height: 450 });
	await juntoDoCampo();

	await page.setViewportSize({ width: 400, height: 850 });
	for (let i = 1; i <= 25; i++) await enviar(page, `Mensagem ${i}`);
	await page.setViewportSize({ width: 400, height: 450 });
	await juntoDoCampo();
});
