import { describe, expect, it } from 'vitest';
import { WrongPinError, type KdfParams } from '../crypto/seal.ts';
import {
	InvalidPhraseError,
	matchWord,
	normalizeWord,
	parsePhrase,
	pickCheckPositions,
	suggestWords
} from './phrase.ts';
import { createVault, InvalidPinError, PhraseMismatchError } from './vault.ts';

const FAST: KdfParams = { memoryKiB: 64, iterations: 1, parallelism: 1 };

// frase válida fixa, para os testes não dependerem do sorteio
const PHRASE = 'segredo surreal dissipar altitude folgado bocejo hidratar lampejo fundar recado charme casca';

describe('frase de recuperação', () => {
	it('aceita maiúsculas, acentos e espaços extras', () => {
		expect(normalizeWord(' Fôlgado ')).toBe('folgado');
		expect(parsePhrase(`  ${PHRASE.toUpperCase().replace('FOLGADO', 'Fôlgado')}  `).join(' ')).toBe(PHRASE);
	});

	it('completa palavras a partir de 4 letras', () => {
		expect(matchWord('segr')).toBe('segredo');
		expect(matchWord('seg')).toBeUndefined();
		expect(parsePhrase(PHRASE.split(' ').map((w) => w.slice(0, 4))).join(' ')).toBe(PHRASE);
	});

	it('sugere palavras enquanto a pessoa digita', () => {
		expect(suggestWords('aba')).toEqual(['abacate', 'abaixo', 'abalar', 'abater']);
		expect(suggestWords('a')).toEqual([]);
	});

	it('explica o que está errado', () => {
		expect(() => parsePhrase('segredo surreal')).toThrow(/foram digitadas 2/);
		expect(() => parsePhrase(PHRASE.replace('dissipar', 'xyzw'))).toThrow(/3ª palavra/);
		// palavras válidas, mas fora de ordem: o dígito verificador do BIP-39 pega
		const swapped = PHRASE.split(' ');
		[swapped[0], swapped[1]] = [swapped[1], swapped[0]];
		expect(() => parsePhrase(swapped)).toThrow(InvalidPhraseError);
	});

	it('sorteia posições diferentes para o teste de verificação', () => {
		for (let i = 0; i < 50; i++) {
			const [a, b] = pickCheckPositions();
			expect(a).toBeLessThan(b);
			expect(a).toBeGreaterThanOrEqual(0);
			expect(b).toBeLessThan(12);
		}
	});
});

describe('cofre da identidade', () => {
	it('cria, bloqueia e desbloqueia com o PIN', async () => {
		const vault = createVault({ kdf: FAST });
		const { publicKey, phrase, words } = await vault.create('123456');
		expect(words).toHaveLength(12);
		expect(vault.isUnlocked()).toBe(true);
		vault.lock();
		expect(vault.isUnlocked()).toBe(false);
		await expect(vault.unlock(phrase, '000000')).rejects.toBeInstanceOf(WrongPinError);
		expect(await vault.unlock(phrase, '123456')).toBe(publicKey);
	});

	it('só aceita PIN de 6 dígitos', async () => {
		const vault = createVault({ kdf: FAST });
		for (const pin of ['12345', '1234567', '12345a', '']) {
			await expect(vault.create(pin)).rejects.toBeInstanceOf(InvalidPinError);
		}
	});

	it('restaura a mesma chave pela frase, em outro aparelho', async () => {
		const original = await createVault({ kdf: FAST }).create('123456');
		const restored = await createVault({ kdf: FAST }).restore(original.words, '654321');
		expect(restored.publicKey).toBe(original.publicKey);
	});

	it('deriva a chave pelo NIP-06, igual a outros apps com a mesma frase', async () => {
		const { publicKey } = await createVault({ kdf: FAST }).restore(PHRASE, '123456');
		expect(publicKey).toMatch(/^[0-9a-f]{64}$/);
		const again = await createVault({ kdf: FAST }).restore(PHRASE, '999999');
		expect(again.publicKey).toBe(publicKey);
	});

	it('mostra a frase de novo com o PIN', async () => {
		const vault = createVault({ kdf: FAST });
		const { phrase, words } = await vault.create('123456');
		expect(await vault.reveal(phrase, '123456')).toEqual(words);
		await expect(vault.reveal(phrase, '111111')).rejects.toBeInstanceOf(WrongPinError);
	});

	it('troca o PIN esquecido usando a frase da mesma identidade', async () => {
		const vault = createVault({ kdf: FAST });
		const { publicKey, words } = await vault.create('123456');
		vault.lock();
		const resealed = await vault.resetPin(words, '777777', publicKey);
		expect(vault.isUnlocked()).toBe(true);
		vault.lock();
		expect(await vault.unlock(resealed, '777777')).toBe(publicKey);
	});

	it('não troca o PIN com a frase de outra identidade', async () => {
		const vault = createVault({ kdf: FAST });
		const { publicKey } = await vault.create('123456');
		await expect(vault.resetPin(PHRASE, '777777', publicKey)).rejects.toBeInstanceOf(PhraseMismatchError);
	});
});
