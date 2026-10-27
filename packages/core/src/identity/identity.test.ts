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
import {
	createVault,
	InvalidPinError,
	InvalidWrapError,
	LockedError,
	PhraseMismatchError,
	SESSION_IDLE_MS,
	sessionIsOpen
} from './vault.ts';
import { getEventHash, getPublicKey, generateSecretKey, finalizeEvent } from 'nostr-tools/pure';
import { wrapEvent, createWrap } from 'nostr-tools/nip59';
import { encrypt, getConversationKey } from 'nostr-tools/nip44';

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

	it('diz o problema em código, para a interface traduzir (ADR-0008)', () => {
		const problem = (input: string | string[]) => {
			try {
				parsePhrase(input);
			} catch (err) {
				return (err as InvalidPhraseError).detail;
			}
		};
		expect(problem('segredo surreal')).toEqual({ reason: 'tamanho', count: 2 });
		expect(problem(PHRASE.replace('dissipar', 'xyzw'))).toEqual({ reason: 'palavra', position: 3, word: 'xyzw' });
		const swapped = PHRASE.split(' ');
		[swapped[0], swapped[1]] = [swapped[1], swapped[0]];
		expect(problem(swapped)).toEqual({ reason: 'soma' });
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

describe('cofre: sessão aberta (recarregar sem PIN)', () => {
	it('desbloqueia pela sessão depois de recarregar, sem o PIN', async () => {
		const vault = createVault({ kdf: FAST });
		const { publicKey } = await vault.create('123456');
		const session = await vault.openSession(1000);
		// recarregar a página: um cofre novo, que só tem a sessão guardada
		const reloaded = createVault({ kdf: FAST });
		expect(await reloaded.resumeSession(session)).toBe(publicKey);
		expect(reloaded.isUnlocked()).toBe(true);
	});

	it('a chave da sessão não sai do navegador', async () => {
		const vault = createVault({ kdf: FAST });
		await vault.create('123456');
		const { key } = await vault.openSession(0);
		expect(key.extractable).toBe(false);
		await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
	});

	it('só abre sessão desbloqueado', async () => {
		await expect(createVault({ kdf: FAST }).openSession(0)).rejects.toBeInstanceOf(LockedError);
	});

	it('vale por alguns minutos sem uso, e não com o relógio voltado', async () => {
		const vault = createVault({ kdf: FAST });
		await vault.create('123456');
		const session = await vault.openSession(10_000);
		expect(sessionIsOpen(session, 10_000 + SESSION_IDLE_MS - 1)).toBe(true);
		expect(sessionIsOpen(session, 10_000 + SESSION_IDLE_MS)).toBe(false);
		expect(sessionIsOpen(session, 9_000)).toBe(false);
	});
});

describe('cofre: assinar e abrir mensagens', () => {
	const now = () => Math.floor(Date.now() / 1000);

	it('assina só os tipos permitidos e só desbloqueado', async () => {
		const vault = createVault({ kdf: FAST });
		const { publicKey } = await vault.create('123456');
		const auth = vault.sign({ kind: 22242, created_at: now(), tags: [], content: '' });
		expect(auth.pubkey).toBe(publicKey);
		expect(() => vault.sign({ kind: 1, created_at: now(), tags: [], content: 'post público' })).toThrow(/não assina/);
		vault.lock();
		expect(() => vault.sign({ kind: 10050, created_at: now(), tags: [], content: '' })).toThrow(LockedError);
	});

	it('abre um gift wrap endereçado a mim', async () => {
		const vault = createVault({ kdf: FAST });
		const { publicKey } = await vault.create('123456');
		const sender = generateSecretKey();
		const wrap = wrapEvent({ kind: 14, content: 'oi', tags: [['p', publicKey]] }, sender, publicKey);
		const rumor = vault.unwrap(wrap);
		expect(rumor.content).toBe('oi');
		expect(rumor.pubkey).toBe(getPublicKey(sender));
	});

	it('recusa rumor com id forjado (poderia sobrescrever outra mensagem)', async () => {
		const vault = createVault({ kdf: FAST });
		const { publicKey } = await vault.create('123456');
		const sender = generateSecretKey();
		const rumor = { kind: 14, content: 'oi', tags: [], created_at: now(), pubkey: getPublicKey(sender) };
		const forged = { ...rumor, id: 'a'.repeat(64) };
		expect(getEventHash(rumor)).not.toBe(forged.id);
		// selo e embrulho montados à mão, com o id falso no rumor
		const seal = finalizeEvent(
			{ kind: 13, created_at: now(), tags: [], content: encrypt(JSON.stringify(forged), getConversationKey(sender, publicKey)) },
			sender
		);
		expect(() => vault.unwrap(createWrap(seal, publicKey))).toThrow(InvalidWrapError);
	});

	it('recusa embrulho que não é para mim', async () => {
		const vault = createVault({ kdf: FAST });
		await vault.create('123456');
		const other = getPublicKey(generateSecretKey());
		const wrap = wrapEvent({ kind: 14, content: 'oi', tags: [] }, generateSecretKey(), other);
		expect(() => vault.unwrap(wrap)).toThrow(InvalidWrapError);
	});
});
