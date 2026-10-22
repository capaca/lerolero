// Áudio (RF-40): gravar pelo microfone simulado, enviar cifrado aos dois Blossom, tocar do outro lado,
// velocidade e um áudio por vez.
import { abrirConversa, adicionarPeloConvite, enviarAudio, expect, test } from '../ajudantes.ts';

test('João grava dois áudios; Maria toca, acelera e só um toca por vez', async ({ novaPessoa }) => {
	const [maria, joao] = await Promise.all([novaPessoa('Maria'), novaPessoa('João')]);
	await adicionarPeloConvite(maria, joao);
	await enviarAudio(joao.page);
	await enviarAudio(joao.page);

	await maria.page.goto('./');
	await expect(maria.page.locator('.conversations a', { hasText: 'João' }).locator('.preview')).toHaveText('Áudio');
	await abrirConversa(maria.page, 'João');
	const players = maria.page.locator('.player');
	await expect(players).toHaveCount(2);
	const audios = maria.page.locator('audio');
	const tocando = () => audios.evaluateAll((as) => as.map((a) => !(a as HTMLAudioElement).paused));

	// baixa, confere o hash, decifra e toca
	await players.nth(0).getByRole('button', { name: 'Tocar' }).click();
	await expect(players.nth(0).getByRole('button', { name: 'Pausar' })).toBeVisible();
	await players.nth(0).getByRole('button', { name: 'Velocidade' }).click();
	await expect(players.nth(0).getByRole('button', { name: 'Velocidade' })).toHaveText('1,5x');
	expect(await audios.nth(0).evaluate((a) => (a as HTMLAudioElement).playbackRate)).toBe(1.5);
	await expect.poll(() => audios.nth(0).evaluate((a) => (a as HTMLAudioElement).currentTime)).toBeGreaterThan(0.3);

	// tocar o segundo pausa o primeiro, e vice-versa
	await players.nth(1).getByRole('button', { name: 'Tocar' }).click();
	await expect.poll(tocando).toEqual([false, true]);
	await expect(players.nth(0).getByRole('button', { name: 'Tocar' })).toBeVisible();
	await players.nth(0).getByRole('button', { name: 'Tocar' }).click();
	await expect.poll(tocando).toEqual([true, false]);
});
