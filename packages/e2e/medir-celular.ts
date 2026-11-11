// Mede o app de verdade num celular Android ligado por USB (Q-N4, RNF-10 a 15): o build de produção servido no
// Mac, com os relays locais da suíte, chega ao celular pelo `adb reverse` (127.0.0.1 é contexto seguro, sem flag).
// Uma pessoa no Mac escreve N mensagens; o celular recebe, abre a conversa, rola e envia.
// Uso (na raiz, com o build pronto e o celular com depuração USB):
//   pnpm -s --filter @lerolero/e2e medir-celular [mensagens=2000] > resultado.json   (uns 15 min com 2000)
import { execFileSync } from 'node:child_process';
import { chromium, type Page } from '@playwright/test';
import { FakeRelay } from '../core/src/testing/fake-relay.ts';
import { pagesServer, APP_URL } from './servidores.ts';
import { adicionarPeloConvite, criarConta, cadastrar, confirmarConvite, noInicio, PIN, digitarPin } from './ajudantes.ts';

const N = Number(process.argv[2] ?? 2000);
const adb = (...args: string[]) => execFileSync('adb', args, { encoding: 'utf8' }).trim();
const log = (...a: unknown[]) => console.error(new Date().toISOString().slice(11, 19), ...a);
const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const stats = (a: number[]) => ({ n: a.length, mediana: median(a), max: Math.max(...a), min: Math.min(...a) });

// ---------- servidores locais, nas portas que o celular alcança pelo adb reverse ----------
const [dm, geral] = await Promise.all([new FakeRelay().start(4191), new FakeRelay().start(4192)]);
const relays = JSON.stringify({ versao: 1, atualizado: '9999-12-31', dm: [dm.url], geral: [geral.url], blossom: ['https://127.0.0.1:4193'] });
const server = pagesServer(relays);
await new Promise<void>((r) => server.listen(4190, '127.0.0.1', r));
for (const port of [4190, 4191, 4192]) adb('reverse', `tcp:${port}`, `tcp:${port}`);
adb('forward', 'tcp:9222', 'localabstract:chrome_devtools_remote');

const resultado: Record<string, unknown> = { data: new Date().toISOString(), mensagens: N };

// ---------- celular: aba nova, dados do site limpos ----------
const celular = await chromium.connectOverCDP('http://localhost:9222');
const ctxCel = celular.contexts()[0];
const tel = await ctxCel.newPage();
// só a aba do app aberta: a memória do processo dela fica sem as outras
for (const p of ctxCel.pages()) if (p !== tel) await p.close();
await tel.goto(APP_URL);
await tel.evaluate(async () => {
	for (const db of await indexedDB.databases()) if (db.name) indexedDB.deleteDatabase(db.name);
	localStorage.clear();
	for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
});
await tel.goto(APP_URL);

// ---------- Mac: quem escreve ----------
const mac = await chromium.launch({ channel: 'chrome' });
const ctxMac = await mac.newContext({ baseURL: APP_URL, permissions: ['clipboard-read', 'clipboard-write'], viewport: { width: 400, height: 850 }, locale: 'pt-BR' });
const ana = await ctxMac.newPage();

log('criando as contas');
await Promise.all([criarConta(ana, 'Ana'), (async () => { await cadastrar(tel, 'Celular'); await noInicio(tel); })()]);

// o convite do celular, lido do clipboard interceptado (o Chrome do celular não deixa ler)
async function conviteDoCelular(page: Page) {
	await page.goto(APP_URL + 'contatos/meu-convite');
	await page.evaluate(() => {
		navigator.clipboard.writeText = async (t: string) => void ((window as unknown as { __c: string }).__c = t);
	});
	await page.getByRole('button', { name: 'Copiar link' }).click();
	return page.evaluate(() => (window as unknown as { __c: string }).__c);
}
// o celular adiciona a Ana e fica na conversa; depois a Ana adiciona o celular e abre a conversa
await adicionarPeloConvite({ nome: 'Ana', page: ana }, { nome: 'Celular', page: tel });
const conversaNoCelular = tel.url();
const convite = await conviteDoCelular(tel);
await tel.goto(conversaNoCelular);
await ana.goto(convite);
await confirmarConvite(ana);
await ana.getByRole('link', { name: 'Conversar' }).click();

// ---------- Ana escreve N mensagens; o celular recebe com a conversa aberta ----------
log(`enviando ${N} mensagens`);
const t0 = Date.now();
const campo = ana.getByLabel('Mensagem');
const enviar = ana.getByRole('button', { name: 'Enviar', exact: true });
for (let i = 1; i <= N; i++) {
	await campo.fill(`Mensagem ${i} de ${N}: ${'lero '.repeat(1 + (i % 12))}`);
	await enviar.click();
	if (i % 200 === 0) log(`  ${i}`);
}
// sem esperar o "enviada" no Mac: com o celular lendo, ela passa direto para entregue ou lida
resultado.digitadasNoMacS = (Date.now() - t0) / 1000;
await tel.locator('.row', { hasText: `Mensagem ${N} de ${N}:` }).waitFor({ timeout: 600_000 });
resultado.recebidasNoCelularS = (Date.now() - t0) / 1000;
log('recebidas', resultado.recebidasNoCelularS, 's');

// ---------- RNF-11: abrir a conversa (do início até a última mensagem na tela), 5 vezes ----------
async function abrirConversa(page: Page) {
	await page.goto(APP_URL);
	await noInicio(page);
	await page.waitForTimeout(1500);
	return page.evaluate(async (ultima) => {
		const t = performance.now();
		(document.querySelector('.conversations a') as HTMLElement).click();
		for (;;) {
			await new Promise(requestAnimationFrame);
			const row = [...document.querySelectorAll('.messages .row')].find((r) => r.textContent?.includes(ultima));
			if (row && row.getBoundingClientRect().height > 0) return performance.now() - t;
		}
	}, `Mensagem ${N} de ${N}:`);
}
const abrir: number[] = [];
for (let i = 0; i < 5; i++) abrir.push(await abrirConversa(tel));
resultado.abrirConversaMs = stats(abrir);
log('abrir conversa', resultado.abrirConversaMs);

// ---------- RNF-14: rolar para cima, como o protótipo (2500 px/s, 12 s), 3 vezes ----------
async function rolar(page: Page) {
	return page.evaluate(async () => {
		const el = document.querySelector('.messages') as HTMLElement;
		el.scrollTop = el.scrollHeight;
		await new Promise((r) => setTimeout(r, 500));
		let longTasks = 0;
		const obs = new PerformanceObserver((l) => (longTasks += l.getEntries().length));
		obs.observe({ type: 'longtask' });
		const frames: number[] = [];
		const inicio = performance.now();
		let last = inicio;
		let older = 0;
		while (performance.now() - inicio < 12_000) {
			const now: number = await new Promise(requestAnimationFrame);
			frames.push(now - last);
			el.scrollTop -= (2500 * (now - last)) / 1000;
			last = now;
			// no topo, carrega as anteriores como quem toca no botão
			if (el.scrollTop <= 0) {
				const b = el.querySelector('.older') as HTMLElement | null;
				if (!b) break;
				b.click();
				older++;
			}
		}
		obs.disconnect();
		frames.shift();
		const ordenados = [...frames].sort((a, b) => a - b);
		const p95 = ordenados[Math.floor(ordenados.length * 0.95)];
		const engasgos = frames.filter((f) => f > 50).length;
		const dur = frames.reduce((a, b) => a + b, 0);
		return { fps: (frames.length * 1000) / dur, quadroMediano: ordenados[Math.floor(ordenados.length / 2)], quadroP95: p95, engasgos, longTasks, anterioresCarregadas: older };
	});
}
const rolagens = [];
for (let i = 0; i < 3; i++) {
	await abrirConversa(tel);
	await tel.waitForTimeout(1000);
	rolagens.push(await rolar(tel));
}
resultado.rolagem = rolagens;
log('rolagem', rolagens);

// ---------- RNF-12: do toque em Enviar até o balão na tela, 10 vezes ----------
await abrirConversa(tel);
const envio: number[] = [];
for (let i = 1; i <= 10; i++) {
	await tel.getByLabel('Mensagem').fill(`Resposta ${i}`);
	await tel.waitForTimeout(400);
	envio.push(
		await tel.evaluate(async (texto) => {
			const t = performance.now();
			(document.querySelector('button[aria-label="Enviar"]') as HTMLElement).click();
			for (;;) {
				await new Promise(requestAnimationFrame);
				if ([...document.querySelectorAll('.row.mine')].some((r) => r.textContent?.includes(texto))) return performance.now() - t;
			}
		}, `Resposta ${i}`)
	);
}
resultado.envioNaTelaMs = stats(envio);
log('envio', resultado.envioNaTelaMs);

// ---------- RNF-15: memória (heap JS da aba e PSS dos processos do Chrome) ----------
resultado.heapJsMB = await tel.evaluate(() => Math.round(((performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize) / 2 ** 20));
resultado.memoriaChrome = adb('shell', 'dumpsys meminfo | grep -E "com.android.chrome"');

// ---------- RNF-10: partida a frio (Chrome fechado) até o PIN e do PIN até a lista ----------
// com PIN: até ele aparecer e do último dígito até a lista; sem PIN: até a lista (limite superior), separado em Chrome e página
const frio: Record<string, number>[] = [];
for (let i = 0; i < 3; i++) {
	await celular.close();
	adb('shell', 'am', 'force-stop', 'com.android.chrome');
	await new Promise((r) => setTimeout(r, 3000));
	const antes = Number(adb('shell', 'date', '+%s%3N'));
	adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', APP_URL, 'com.android.chrome');
	let b;
	for (let k = 0; k < 50 && !b; k++) {
		await new Promise((r) => setTimeout(r, 300));
		b = await chromium.connectOverCDP('http://localhost:9222').catch(() => undefined);
	}
	const page = await (async () => {
		for (;;) {
			const p = b!.contexts()[0].pages().find((p) => p.url().startsWith(APP_URL));
			if (p) return p;
			await new Promise((r) => setTimeout(r, 100));
		}
	})();
	const pin = page.locator('#pin');
	const inicio = page.getByRole('button', { name: 'Nova conversa' });
	await pin.or(inicio).first().waitFor({ timeout: 30_000 });
	const tPin = await page.evaluate(() => Date.now());
	if (await pin.isVisible()) {
		// o tempo começa depois do último dígito: a digitação pelo CDP não conta
		await digitarPin(page, 'pin', PIN.slice(0, -1));
		const medida = page.evaluate(
			() =>
				new Promise<number>((ok) => {
					addEventListener(
						'keydown',
						() => {
							const t = performance.now();
							const espera = () => (document.querySelector('[aria-label="Nova conversa"]') ? ok(performance.now() - t) : requestAnimationFrame(espera));
							requestAnimationFrame(espera);
						},
						{ once: true, capture: true }
					);
				})
		);
		await page.waitForTimeout(300);
		await page.keyboard.type(PIN.slice(-1));
		frio.push({ ateOPinMs: tPin - antes, doPinAteAListaMs: await medida });
	} else {
		// sem PIN: limite superior (inclui a espera do CDP), com a navegação separada da abertura do Chrome
		const [agora, origem, carregou] = await page.evaluate(() => [
			Date.now(),
			performance.timeOrigin,
			(performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).loadEventEnd
		]);
		frio.push({ ateAListaMs: agora - antes, chromeAteNavegarMs: Math.round(origem - antes), carregouMs: Math.round(carregou) });
	}
	log('frio', frio.at(-1));
	await b!.close();
}
resultado.partidaAFrio = frio;

console.log(JSON.stringify(resultado, null, 2));
await mac.close();
server.close();
await Promise.all([dm.stop(), geral.stop()]);
for (const port of [4190, 4191, 4192]) adb('reverse', '--remove', `tcp:${port}`);
process.exit(0);
