// Silêncio no começo do áudio (pedido do Pedro em 2026-10-26): o player começa onde a voz começa e mostra só o
// que vai tocar. A detecção em si é testada no core (voice-start.test.ts); a mensagem leva o ponto de início
// na tag `start`. O microfone simulado não tem silêncio, então o início é marcado no registro da mensagem.
import { abrirConversa, adicionarUmAoOutro, enviarAudio, expect, test } from '../ajudantes.ts';

test('o player começa depois do silêncio do começo e a barra continua inteira', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await adicionarUmAoOutro(maria, joao);
	// longo o bastante para não terminar durante o teste, mesmo numa máquina lenta
	await enviarAudio(joao.page, 8);

	await abrirConversa(maria.page, 'João');
	await expect(maria.page.locator('.player')).toHaveCount(1);
	// a gravação dura o que a máquina deixar (8 s pedidos, 10 s numa máquina cheia): a conferência usa a duração real
	const duracao = await maria.page.evaluate(
		() =>
			new Promise<number>((ok, falha) => {
				const req = indexedDB.open('lerolero');
				req.onerror = () => falha(req.error);
				req.onsuccess = () => {
					const tx = req.result.transaction('messages', 'readwrite');
					const store = tx.objectStore('messages');
					let duration = 0;
					store.getAll().onsuccess = (e) => {
						for (const m of (e.target as IDBRequest).result)
							if (m.media) {
								duration = m.media.duration;
								store.put({ ...m, media: { ...m.media, start: 2 } });
							}
					};
					tx.oncomplete = () => ok(duration);
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
	// o tempo aparece com a duração do arquivo e depois sem o silêncio, quando o navegador termina de carregar
	// (numa máquina cheia isso demora): espera o valor assentar em vez de ler no primeiro quadro (2026-10-27)
	await expect.poll(mostrado).toBeLessThanOrEqual(duracao - 1);

	await maria.page.getByRole('button', { name: 'Tocar' }).click();
	await expect(maria.page.getByRole('button', { name: 'Pausar' })).toBeVisible();
	// começou pelo ponto de início, e não do zero
	await expect.poll(() => maria.page.locator('audio').evaluate((a) => (a as HTMLAudioElement).currentTime)).toBeGreaterThanOrEqual(2);
	// espera o áudio andar de verdade (numa máquina lenta ele ainda carrega, e o navegador só deixa pular depois)
	await expect.poll(() => maria.page.locator('audio').evaluate((a) => (a as HTMLAudioElement).currentTime)).toBeGreaterThan(2.3);

	// o tempo mostrado desconta o silêncio: confere contra a posição do áudio lida no mesmo instante. Com a máquina
	// cheia o áudio andava vários segundos entre duas leituras, e um limite fixo deixava de valer (2026-10-27)
	await expect
		.poll(() =>
			maria.page.evaluate(() => {
				const a = document.querySelector('audio') as HTMLAudioElement;
				const [min, seg] = document.querySelector('.player .time')!.textContent!.split(':').map(Number);
				return min * 60 + seg - Math.max(0, a.currentTime - 2);
			})
		)
		.toBeLessThanOrEqual(1);
	await maria.page.getByRole('button', { name: 'Pausar' }).click();

	// a barra continua inteira: dá para voltar ao começo e ouvir o trecho vazio
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
