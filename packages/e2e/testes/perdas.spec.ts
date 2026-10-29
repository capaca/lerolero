// Detecção de perdas (RF-53, docs/06 §3.5): a mensagem que se perdeu no caminho volta sozinha quando quem recebe nota
// o buraco na numeração; sem confirmação em 7 dias, quem enviou vê "Talvez não tenha chegado" e pode reenviar.
import type { Page } from '@playwright/test';
import { abrirConversaQuandoChegar, adicionarUmAoOutro, enviarTexto, expect, test, type Pessoa } from '../ajudantes.ts';

/**
 * Faz o próximo embrulho para `para` sumir no caminho: os relays nunca o recebem, mas o app ouve um OK falso e acha
 * que enviou (como um relay que aceita e perde). Recarrega para todas as conexões passarem pelo desvio.
 */
async function perderOProximo(page: Page, para: string): Promise<() => void> {
	let armado = false;
	const perdidos = new Set<string>();
	await page.routeWebSocket(/.*/, (ws) => {
		const servidor = ws.connectToServer();
		ws.onMessage((mensagem) => {
			const [tipo, evento] = typeof mensagem === 'string' ? JSON.parse(mensagem) : [];
			if (tipo === 'EVENT' && evento?.kind === 1059) {
				if (armado && evento.tags.some((t: string[]) => t[0] === 'p' && t[1] === para)) {
					armado = false;
					perdidos.add(evento.id);
				}
				if (perdidos.has(evento.id)) return void ws.send(JSON.stringify(['OK', evento.id, true, '']));
			}
			servidor.send(mensagem);
		});
		servidor.onMessage((mensagem) => ws.send(mensagem));
	});
	await page.reload();
	await expect(page.getByLabel('Mensagem')).toBeVisible();
	return () => (armado = true);
}

/** A chave pública de quem está no aparelho, em hex (a do convite é a npub; esta é a dos eventos). */
const minhaChave = (pessoa: Pessoa) =>
	pessoa.page.evaluate(async () => {
		const banco = await new Promise<IDBDatabase>((ok, falha) => {
			const pedido = indexedDB.open('lerolero');
			pedido.onsuccess = () => ok(pedido.result);
			pedido.onerror = () => falha(pedido.error);
		});
		const identidades = await new Promise<Array<{ publicKey: string }>>((ok) => {
			const pedido = banco.transaction('identity').objectStore('identity').getAll();
			pedido.onsuccess = () => ok(pedido.result);
		});
		banco.close();
		return identidades[0].publicKey;
	});

test('a mensagem que se perdeu no caminho chega sozinha depois, quando a seguinte mostra o buraco', async ({ novaPessoa }) => {
	test.setTimeout(150_000);
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await adicionarUmAoOutro(maria, joao);
	const perder = await perderOProximo(joao.page, await minhaChave(maria));

	await enviarTexto(joao.page, 'primeira');
	await abrirConversaQuandoChegar(maria.page, 'João');
	await expect(maria.page.locator('.row', { hasText: 'primeira' })).toBeVisible({ timeout: 30_000 });
	perder();
	await enviarTexto(joao.page, 'segunda, que se perde');
	await enviarTexto(joao.page, 'terceira');
	await expect(maria.page.locator('.row', { hasText: 'terceira' })).toBeVisible({ timeout: 30_000 });
	await expect(maria.page.locator('.row', { hasText: 'segunda' })).toHaveCount(0);

	// a Maria nota que falta a 2, espera a janela e pede; o João reenvia sozinho, sem aviso para ninguém
	await expect(maria.page.locator('.row', { hasText: 'segunda, que se perde' })).toBeVisible({ timeout: 90_000 });
	await expect(maria.page.locator('.row:not(.mine)')).toHaveText([/primeira/, /segunda, que se perde/, /terceira/]);
	await expect(joao.page.locator('.row.mine', { hasText: 'segunda' }).getByLabel('enviada e lida')).toBeVisible({ timeout: 30_000 });
});

test('sem confirmação em 7 dias, quem enviou vê "Talvez não tenha chegado" e reenvia', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await adicionarUmAoOutro(maria, joao);
	const perder = await perderOProximo(joao.page, await minhaChave(maria));

	perder();
	await enviarTexto(joao.page, 'você recebeu?');
	const balao = joao.page.locator('.row.mine', { hasText: 'você recebeu?' });
	await expect(balao.getByLabel('Enviada', { exact: true })).toBeVisible({ timeout: 20_000 });
	await expect(balao.getByText('Talvez não tenha chegado')).toHaveCount(0);

	// oito dias depois, no relógio do João: volta à lista e abre a conversa de novo (sem recarregar, que pediria o PIN)
	await joao.page.clock.setFixedTime(Date.now() + 8 * 24 * 60 * 60 * 1000);
	await joao.page.getByRole('link', { name: 'Voltar para as conversas' }).click();
	await joao.page.locator('.conversations a', { hasText: 'Maria' }).click();
	await expect(balao.getByText('Talvez não tenha chegado')).toBeVisible();

	await balao.getByRole('button', { name: 'Reenviar' }).click();
	await expect(balao.getByText('Talvez não tenha chegado')).toHaveCount(0);
	await abrirConversaQuandoChegar(maria.page, 'João');
	await expect(maria.page.locator('.row', { hasText: 'você recebeu?' })).toBeVisible({ timeout: 30_000 });
	await expect(balao.getByLabel('enviada e lida')).toBeVisible({ timeout: 30_000 });
});
