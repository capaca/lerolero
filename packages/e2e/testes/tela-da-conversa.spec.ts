// Tela da conversa: as mensagens antigas do contato entram direto no IndexedDB, sem depender de entrega.
import type { Page } from '@playwright/test';
import { adicionarPeloConvite, enviarTexto, expect, test } from '../ajudantes.ts';

const OUTRO = 'ab'.repeat(32);

async function enviar(page: Page, texto: string) {
	await page.getByLabel('Mensagem').fill(texto);
	await page.getByRole('button', { name: 'Enviar', exact: true }).click();
	await expect(page.locator('.row', { hasText: texto })).toBeVisible();
}

/** Grava mensagens do contato no aparelho, como se tivessem chegado: [id, texto, segundos]. */
const receber = (page: Page, lista: [string, string, number][], outro = OUTRO) =>
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
		{ lista, outro }
	);

/** Marca as últimas `n` mensagens da conversa com o contato como não lidas. */
const naoLidas = (page: Page, outro: string, n: number) =>
	page.evaluate(
		({ outro, n }) =>
			new Promise<void>((ok, falha) => {
				const req = indexedDB.open('lerolero');
				req.onerror = () => falha(req.error);
				req.onsuccess = () => {
					const tx = req.result.transaction('conversations', 'readwrite');
					const store = tx.objectStore('conversations');
					const id = 'direta:' + outro;
					store.get(id).onsuccess = (e) => {
						const nova = { id, type: 'direta', members: [outro], lastMessageAt: Math.floor(Date.now() / 1000) };
						store.put({ ...nova, ...(e.target as IDBRequest).result, unread: n });
					};
					tx.oncomplete = () => ok();
				};
			}),
		{ outro, n }
	);

/** Onde está a rolagem da conversa. */
const rolagem = (page: Page) =>
	page.locator('.messages').evaluate((s) => ({ noFim: s.scrollHeight - s.scrollTop - s.clientHeight < 8 }));

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

test('"Mensagens novas" ao abrir e ao chegar, com o botão de ir para o fim contando', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await adicionarPeloConvite(maria, joao);
	const conversaComMaria = joao.page.url();
	await adicionarPeloConvite(joao, maria);
	const chaveDoJoao = maria.page.url().split('/').at(-1)!;
	await joao.page.goto(conversaComMaria);
	const antes = Math.floor(Date.now() / 1000) - 3600;
	await receber(maria.page, Array.from({ length: 60 }, (_, i) => [`h${i}`, `Antiga ${i}`, antes + i * 30] as [string, string, number]), chaveDoJoao);
	await naoLidas(maria.page, chaveDoJoao, 5);

	// abre na linha, antes da primeira não lida; com poucas, isso já mostra o fim e não há botão.
	// regressão (2026-10-22): os blocos ainda não desenhados encolhiam e às vezes a conversa abria no topo
	await maria.page.reload();
	await expect(maria.page.locator('.new-line + *')).toContainText('Antiga 55');
	// toBeInViewport não serve: dentro dos blocos com content-visibility ele vê sempre 0
	const linhaNaTela = () =>
		maria.page.evaluate(() => {
			const area = document.querySelector('.messages')!.getBoundingClientRect();
			const linha = document.querySelector('.new-line')!.getBoundingClientRect();
			return linha.top >= area.top && linha.bottom <= area.bottom;
		});
	await expect.poll(linhaNaTela).toBe(true);
	const botao = maria.page.locator('.jump');
	await expect(botao).toHaveCount(0);

	await maria.page.locator('.messages').evaluate((s) => (s.scrollTop = 0));
	await expect(botao).toHaveAccessibleName('Ir para o fim');

	// chegam duas com a Maria lendo lá em cima: o botão conta, a linha muda e a tela não pula
	for (const t of ['Novidade 1', 'Novidade 2']) await enviarTexto(joao.page, t);
	await expect(botao).toHaveAccessibleName('Ir para o fim, 2 mensagens novas');
	await expect(botao.locator('.badge')).toHaveText('2');
	await expect(maria.page.locator('.new-line + *')).toContainText('Novidade 1');
	expect((await rolagem(maria.page)).noFim).toBe(false);
	// regressão: as duas primeiras para alguém saíam no mesmo segundo e chegavam trocadas
	await expect(maria.page.locator('.row p').filter({ hasText: /^Novidade/ })).toHaveText(['Novidade 1', 'Novidade 2']);

	await botao.click();
	await expect.poll(() => rolagem(maria.page)).toEqual({ noFim: true });
	await expect(botao).toHaveCount(0);
});

test('a data do dia aparece no topo ao rolar e some ao parar e no fim', async ({ novaPessoa }) => {
	const { page } = await novaPessoa('Maria');
	await page.goto(`./conversa/${OUTRO}`);
	const meioDia = (diasAtras: number) => {
		const d = new Date();
		d.setDate(d.getDate() - diasAtras);
		d.setHours(12, 0, 0, 0);
		return Math.floor(d.getTime() / 1000);
	};
	const lista: [string, string, number][] = [];
	for (const [diasAtras, dia] of [[1, 'ontem'], [0, 'hoje']] as const)
		for (let i = 0; i < 40; i++) lista.push([`${dia}${i}`, `Mensagem ${i} de ${dia}`, meioDia(diasAtras) - 3600 + i * 60]);
	await receber(page, lista);
	await enviar(page, 'Oi');
	await expect(page.locator('.row')).toHaveCount(81);

	const etiqueta = page.locator('.floating-day');
	await expect(etiqueta).not.toHaveClass(/visible/);
	const rolarAte = (texto: string) =>
		page.locator('.messages').evaluate((s, texto) => {
			const row = [...s.querySelectorAll('.row')].find((r) => r.textContent!.includes(texto))!;
			s.scrollTop += row.getBoundingClientRect().top - s.getBoundingClientRect().top;
		}, texto);

	await rolarAte('Mensagem 30 de ontem');
	await expect(etiqueta).toHaveClass(/visible/);
	await expect(etiqueta).toHaveText('Ontem');
	await rolarAte('Mensagem 10 de hoje');
	await expect(etiqueta).toHaveText('Hoje');
	await expect(etiqueta).not.toHaveClass(/visible/, { timeout: 3000 });

	await page.locator('.messages').evaluate((s) => (s.scrollTop = s.scrollHeight));
	await page.waitForTimeout(300);
	await expect(etiqueta).not.toHaveClass(/visible/);

	// rolagem longa: os blocos desenhados no caminho crescem e o dia do topo tem de acompanhar
	await page.locator('.messages').evaluate((s) => (s.scrollTop -= 2500));
	await expect(etiqueta).toHaveClass(/visible/);
	await expect(etiqueta).toHaveText('Ontem');
});

test('"Copiar" no menu da mensagem, por botão direito e toque longo, com vibração', async ({ novaPessoa }) => {
	const { page } = await novaPessoa('Maria');
	// o Chrome do computador não vibra: registra as chamadas
	await page.addInitScript(() => {
		(window as unknown as { vibrou: unknown[] }).vibrou = [];
		navigator.vibrate = (p) => ((window as unknown as { vibrou: unknown[] }).vibrou.push(p), true);
	});
	await page.goto(`./conversa/${OUTRO}`);
	const vibracoes = () => page.evaluate(() => (window as unknown as { vibrou: unknown[] }).vibrou.length);
	const texto = 'Endereço: Rua das Flores, 123\nApto 45';
	await enviar(page, texto);
	const balao = page.locator('.row .bubble').first();
	const menu = page.getByRole('dialog', { name: 'Opções da mensagem' });

	await balao.click({ button: 'right' });
	await expect(menu.locator('.item').first()).toHaveText('Copiar');
	expect(await vibracoes()).toBe(1);
	await menu.getByRole('button', { name: 'Copiar' }).click();
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(texto);
	await expect(menu).toHaveCount(0);
	await expect(page.getByRole('status').filter({ hasText: 'Mensagem copiada' })).toBeVisible();
	await expect(page.getByText('Mensagem copiada')).toHaveCount(0, { timeout: 5000 });

	// toque longo, como no celular
	const caixa = (await balao.boundingBox())!;
	await page.mouse.move(caixa.x + 20, caixa.y + 15);
	await page.mouse.down();
	await page.waitForTimeout(700);
	await page.mouse.up();
	await expect(menu).toBeVisible();
	expect(await vibracoes()).toBe(2);
});
