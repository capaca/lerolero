// Cofre da identidade. Roda dentro do Web Worker: a chave privada nasce, vive e
// morre aqui, e a interface só recebe a chave pública e lacres já cifrados.

import { getPublicKey } from 'nostr-tools/pure';
import { privateKeyFromSeedWords } from 'nostr-tools/nip06';
import { DEFAULT_KDF, seal, unseal, type KdfParams, type Sealed } from '../crypto/seal.ts';
import { generatePhrase, parsePhrase } from './phrase.ts';

export class InvalidPinError extends Error {
	constructor() {
		super('O PIN tem 6 dígitos');
		this.name = 'InvalidPinError';
	}
}

/** A frase digitada é válida, mas é de outra identidade. */
export class PhraseMismatchError extends Error {
	constructor() {
		super('Esta frase é de outra identidade');
		this.name = 'PhraseMismatchError';
	}
}

export class LockedError extends Error {
	constructor() {
		super('A identidade está bloqueada');
		this.name = 'LockedError';
	}
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function checkPin(pin: string) {
	if (!/^\d{6}$/.test(pin)) throw new InvalidPinError();
}

// NIP-06 deriva a chave da frase; o caminho padrão é m/44'/1237'/0'/0/0
const keyFromWords = (words: string[]) => privateKeyFromSeedWords(words.join(' '));
const sealWords = (words: string[], pin: string, kdf: KdfParams) => seal(encoder.encode(words.join(' ')), pin, kdf);

export type NewIdentity = { publicKey: string; phrase: Sealed; words: string[] };

export function createVault({ kdf = DEFAULT_KDF }: { kdf?: KdfParams } = {}) {
	let secretKey: Uint8Array | undefined;

	const unlockWith = (words: string[]) => {
		secretKey = keyFromWords(words);
		return getPublicKey(secretKey);
	};

	return {
		/** Cria uma identidade nova e já deixa desbloqueada. As palavras voltam para serem mostradas uma vez. */
		async create(pin: string): Promise<NewIdentity> {
			checkPin(pin);
			const words = generatePhrase();
			const phrase = await sealWords(words, pin, kdf);
			return { publicKey: unlockWith(words), phrase, words };
		},

		/** Restaura pela frase num aparelho novo (RF-05). */
		async restore(input: string | string[], pin: string): Promise<Omit<NewIdentity, 'words'>> {
			checkPin(pin);
			const words = parsePhrase(input);
			const phrase = await sealWords(words, pin, kdf);
			return { publicKey: unlockWith(words), phrase };
		},

		/** Abre com o PIN; lança WrongPinError se não confere. Devolve a chave pública. */
		async unlock(phrase: Sealed, pin: string): Promise<string> {
			const words = decoder.decode(await unseal(phrase, pin)).split(' ');
			return unlockWith(words);
		},

		/** Mostra a frase de novo, pedindo o PIN ("ver minha frase", lembrete do RF-04). */
		async reveal(phrase: Sealed, pin: string): Promise<string[]> {
			return decoder.decode(await unseal(phrase, pin)).split(' ');
		},

		/**
		 * "Esqueci o PIN": com a frase, lacra de novo com um PIN novo. Só aceita a frase
		 * da identidade que já está no aparelho, para as conversas guardadas continuarem dela.
		 */
		async resetPin(input: string | string[], newPin: string, expectedPublicKey: string): Promise<Sealed> {
			checkPin(newPin);
			const words = parsePhrase(input);
			if (getPublicKey(keyFromWords(words)) !== expectedPublicKey) throw new PhraseMismatchError();
			const phrase = await sealWords(words, newPin, kdf);
			unlockWith(words);
			return phrase;
		},

		lock() {
			secretKey?.fill(0);
			secretKey = undefined;
		},

		isUnlocked(): boolean {
			return secretKey !== undefined;
		}
	};
}

export type Vault = ReturnType<typeof createVault>;
