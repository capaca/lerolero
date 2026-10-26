// Silêncio no começo do áudio (pedido do Pedro em 2026-10-26): o player começa onde a voz começa e mostra só o
// que vai tocar. A detecção em si é testada no core (voice-start.test.ts); a mensagem leva o ponto de início
// na tag `start`. O microfone simulado não tem silêncio, então o início é marcado no registro da mensagem.
import { abrirConversa, adicionarPeloConvite, enviarAudio, expect, test } from '../ajudantes.ts';

test('o player começa depois do silêncio do começo e a barra continua inteira', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await adicionarPeloConvite(maria, joao);
	// longo o bastante para não terminar durante o teste, mesmo numa máquina lenta
	await enviarAudio(joao.page, 8);

	await abrirConversa(maria.page, 'João');
	await expect(maria.page.locator('.player')).toHaveCount(1);
	await maria.page.evaluate(
		() =>
			new Promise<void>((ok, falha) => {
				const req = indexedDB.open('lerolero');
				req.onerror = () => falha(req.error);
				req.onsuccess = () => {
					const tx = req.result.transaction('messages', 'readwrite');
					const store = tx.objectStore('messages');
					store.getAll().onsuccess = (e) => {
						for (const m of (e.target as IDBRequest).result) if (m.media) store.put({ ...m, media: { ...m.media, start: 2 } });
					};
					tx.oncomplete = () => ok();
				};
			})
	);
	await maria.page.reload();
	await expect(maria.page.locator('.player')).toHaveCount(1);

	// parado: mostra o que vai tocar (a duração sem o silêncio), não a duração do arquivo
	const tempo = maria.page.locator('.player .time');
	const mostrado = async () => {
		const [min, seg] = (await tempo.innerText()).split(':').map(Number);
		return min * 60 + seg;
	};
	const total = await mostrado();
	expect(total).toBeLessThanOrEqual(7);

	await maria.page.getByRole('button', { name: 'Tocar' }).click();
	await expect(maria.page.getByRole('button', { name: 'Pausar' })).toBeVisible();
	// começou pelo ponto de início, e não do zero
	await expect.poll(() => maria.page.locator('audio').evaluate((a) => (a as HTMLAudioElement).currentTime)).toBeGreaterThanOrEqual(2);
	expect(await mostrado()).toBeLessThanOrEqual(1);

	// a barra continua inteira: dá para voltar ao começo e ouvir o trecho vazio
	await maria.page.getByRole('button', { name: 'Pausar' }).click();
	await maria.page.getByLabel('Posição do áudio').fill('0');
	const estado = () =>
		maria.page.locator('audio').evaluate((el) => {
			const a = el as HTMLAudioElement;
			return { t: a.currentTime, duration: a.duration, seekable: a.seekable.length ? [a.seekable.start(0), a.seekable.end(0)] : [], paused: a.paused, ended: a.ended, readyState: a.readyState };
		});
	await expect
		.poll(async () => (await estado()).t, { message: `estado do áudio: ${JSON.stringify(await estado())}` })
		.toBeLessThan(1);
});
