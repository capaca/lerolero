// Notificações por Web Push (RF-82, ADR-0010). O serviço de push do Chrome (FCM) fica de fora: a inscrição é
// simulada com chaves geradas aqui, o repassador é interceptado e o aviso que ele levaria é decifrado e entregue
// ao service worker pelo DevTools, como o navegador faria com o app fechado.
import type { Page } from '@playwright/test';
import { fakePushDevice } from '../../core/src/testing/fake-push.ts';
import { abrirAjustes, abrirConversaQuandoChegar, adicionarUmAoOutro, digitarPin, enviarTexto, expect, PIN, test } from '../ajudantes.ts';

/** Troca a inscrição do navegador por uma com as chaves do `fakePushDevice` (vale para as próximas páginas). */
async function simularInscricao(page: Page, inscricao: { endpoint: string; p256dh: string; auth: string }) {
	await page.context().grantPermissions(['notifications']);
	await page.context().addInitScript(({ endpoint, p256dh, auth }) => {
		const chave = 'teste.inscricao';
		const sub = {
			endpoint,
			toJSON: () => ({ endpoint, keys: { p256dh, auth } }),
			unsubscribe: async () => (localStorage.removeItem(chave), true)
		};
		PushManager.prototype.subscribe = async () => (localStorage.setItem(chave, '1'), sub as unknown as PushSubscription);
		PushManager.prototype.getSubscription = async () => (localStorage.getItem(chave) ? (sub as unknown as PushSubscription) : null);
	}, inscricao);
}

/** Os aparelhos de push que os cartões guardados aqui trazem (tabela `profiles`). */
const enderecosNosCartoes = (page: Page) =>
	page.evaluate(
		() =>
			new Promise<string[]>((ok, falha) => {
				const req = indexedDB.open('lerolero');
				req.onerror = () => falha(req.error);
				req.onsuccess = () => {
					const all = req.result.transaction('profiles').objectStore('profiles').getAll();
					all.onsuccess = () => ok((all.result as { push?: { endpoint: string }[] }[]).flatMap((c) => c.push?.map((t) => t.endpoint) ?? []));
				};
			})
	);

test('com as notificações ativas, a mensagem gera um aviso só com o nome, e tocar nele abre a conversa depois do PIN', async ({
	novaPessoa
}) => {
	const [ana, bia] = await Promise.all([novaPessoa('Ana'), novaPessoa('Bia')]);
	await adicionarUmAoOutro(ana, bia);
	// o cartão vai a quem já conversou comigo
	await enviarTexto(bia.page, 'oi, Ana');
	await abrirConversaQuandoChegar(ana.page, 'Bia');
	await enviarTexto(ana.page, 'oi, Bia');

	const aparelho = await fakePushDevice();
	await simularInscricao(ana.page, aparelho.target);
	const avisos: { endpoint: string; body: string }[] = [];
	await bia.page.context().route(/workers\.dev/, async (route) => {
		const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' };
		if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
		avisos.push(route.request().postDataJSON());
		await route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ status: 201 }) });
	});

	await ana.page.goto('./');
	await abrirAjustes(ana.page);
	const ativar = ana.page.getByRole('checkbox', { name: 'Avisar quando chegar mensagem' });
	await expect(ativar).not.toBeChecked();
	await ativar.check();
	await expect(ativar).toBeEnabled();
	await expect(ana.page.getByRole('alert')).toBeHidden();

	// o cartão novo de Ana chega a Bia com o endereço; a mensagem de Bia sai e o aviso vai para ele
	await expect.poll(() => enderecosNosCartoes(bia.page), { timeout: 30_000 }).toEqual([aparelho.target.endpoint]);
	await enviarTexto(bia.page, 'chegou o aviso?');
	await expect.poll(() => avisos.length, { timeout: 20_000 }).toBe(1);
	expect(avisos[0].endpoint).toBe(aparelho.target.endpoint);
	const payload = await aparelho.open(avisos[0].body);
	expect(payload).toEqual({ v: 1, de: expect.stringMatching(/^[0-9a-f]{64}$/), nome: 'Bia' });
	expect(JSON.stringify(payload)).not.toContain('chegou o aviso');

	// app fechado: o service worker recebe o aviso e mostra a notificação
	const cdp = await ana.page.context().newCDPSession(ana.page);
	const registros: { registrationId: string; scopeURL: string }[] = [];
	cdp.on('ServiceWorker.workerRegistrationUpdated', (e) => registros.push(...e.registrations));
	await cdp.send('ServiceWorker.enable');
	await expect.poll(() => registros.length).toBeGreaterThan(0);
	await ana.page.goto('about:blank');
	const { registrationId, scopeURL } = registros[0];
	await cdp.send('ServiceWorker.deliverPushMessage', { origin: new URL(scopeURL).origin, registrationId, data: JSON.stringify(payload) });
	const worker = ana.page.context().serviceWorkers()[0] ?? (await ana.page.context().waitForEvent('serviceworker'));
	type Mostrada = { title: string; body: string; url: string };
	type ServiceWorkerGlobal = { registration: { getNotifications(): Promise<Notification[]> } };
	const mostradas = () =>
		worker.evaluate(async () =>
			(await (globalThis as unknown as ServiceWorkerGlobal).registration.getNotifications()).map((n) => ({ title: n.title, body: n.body, url: n.data?.url }) as Mostrada)
		);
	await expect.poll(mostradas).toEqual([{ title: 'Mensagem de Bia', body: 'Toque para abrir a conversa', url: `${scopeURL}conversa/${payload.de}` }]);

	// tocar abre a conversa; passou o prazo da sessão aberta, então o PIN vem antes
	await worker.evaluate(
		() =>
			new Promise<void>((ok) => {
				const req = indexedDB.open('lerolero');
				req.onsuccess = () => {
					const tx = req.result.transaction('settings', 'readwrite');
					tx.objectStore('settings').delete('sessaoAberta');
					tx.oncomplete = () => ok();
				};
			})
	);
	await ana.page.goto((await mostradas())[0].url);
	await expect(ana.page).toHaveURL(/\/desbloquear$/, { timeout: 20_000 });
	await digitarPin(ana.page, 'pin', PIN);
	await expect(ana.page).toHaveURL(/\/conversa\/[0-9a-f]{64}$/);
	await expect(ana.page.getByText('chegou o aviso?')).toBeVisible({ timeout: 20_000 });

	// desativar tira o endereço do cartão
	await ana.page.goto('./ajustes');
	await ana.page.getByRole('checkbox', { name: 'Avisar quando chegar mensagem' }).uncheck();
	await expect.poll(() => enderecosNosCartoes(bia.page), { timeout: 30_000 }).toEqual([]);
});

