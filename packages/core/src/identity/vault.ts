// Cofre da identidade. Roda dentro do Web Worker: a chave privada nasce, vive e
// morre aqui, e a interface só recebe a chave pública e lacres já cifrados.

import { finalizeEvent, getEventHash, getPublicKey, type EventTemplate, type NostrEvent } from 'nostr-tools/pure';
import { privateKeyFromSeedWords } from 'nostr-tools/nip06';
import { createRumor, createSeal, createWrap, unwrapEvent } from 'nostr-tools/nip59';
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

/** A mensagem dentro do gift wrap não é válida (id adulterado, assinatura errada…). */
export class InvalidWrapError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'InvalidWrapError';
	}
}

/** Um rumor (NIP-59): evento sem assinatura, com o id calculado. */
export type Rumor = Omit<NostrEvent, 'sig'>;

/**
 * O cofre só assina o que o app precisa assinar diretamente. Mensagens não passam
 * por aqui: são embrulhadas dentro do cofre. Assim, nem um bug na interface
 * consegue fazer a chave assinar outra coisa em nome da pessoa.
 */
const SIGNABLE_KINDS = new Set([
	22242, // autenticação em relay (NIP-42)
	10050 // relays onde recebo mensagens (NIP-17)
]);

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function checkPin(pin: string) {
	if (!/^\d{6}$/.test(pin)) throw new InvalidPinError();
}

// NIP-06 deriva a chave da frase; o caminho padrão é m/44'/1237'/0'/0/0
const keyFromWords = (words: string[]) => privateKeyFromSeedWords(words.join(' '));
const sealWords = (words: string[], pin: string, kdf: KdfParams) => seal(encoder.encode(words.join(' ')), pin, kdf);

export type NewIdentity = { publicKey: string; phrase: Sealed; words: string[] };

/** Mensagem embrulhada (NIP-17): o rumor guardado localmente e os dois gift wraps a publicar. */
export type WrappedMessage = { rumor: Rumor; toRecipient: NostrEvent; toSelf: NostrEvent };

export const MAX_TEXT_LENGTH = 4000;

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

		/** Assina um dos tipos permitidos (SIGNABLE_KINDS). */
		sign(template: EventTemplate): NostrEvent {
			if (!secretKey) throw new LockedError();
			if (!SIGNABLE_KINDS.has(template.kind)) throw new Error(`o cofre não assina eventos do tipo ${template.kind}`);
			return finalizeEvent(template, secretKey);
		},

		/**
		 * Abre um gift wrap endereçado a mim. O nostr-tools confere a assinatura do selo
		 * e se o autor do rumor é quem assinou; aqui conferimos também o id do rumor,
		 * que vira chave no banco: um id forjado poderia sobrescrever outra mensagem.
		 */
		unwrap(wrap: NostrEvent): Rumor {
			if (!secretKey) throw new LockedError();
			let rumor: Rumor;
			try {
				rumor = unwrapEvent(wrap, secretKey) as Rumor;
			} catch (err) {
				throw new InvalidWrapError(err instanceof Error ? err.message : String(err));
			}
			if (getEventHash(rumor) !== rumor.id) throw new InvalidWrapError('id do rumor não confere com o conteúdo');
			return rumor;
		},

		/**
		 * Embrulha uma mensagem de texto 1:1 (NIP-17, kind 14): um gift wrap para o
		 * destinatário e outro para mim, que vira minha cópia em outros aparelhos.
		 * `extraTags` leva as tags próprias do app (ex.: ["nome", …] na primeira mensagem).
		 */
		wrapDirectMessage(recipient: string, text: string, extraTags: string[][] = []): WrappedMessage {
			if (!secretKey) throw new LockedError();
			if (!/^[0-9a-f]{64}$/.test(recipient)) throw new Error('destinatário inválido');
			if (!text.trim() || text.length > MAX_TEXT_LENGTH) throw new Error('mensagem vazia ou longa demais');
			const rumor = createRumor({ kind: 14, content: text, tags: [['p', recipient], ...extraTags] }, secretKey) as Rumor;
			const me = getPublicKey(secretKey);
			return {
				rumor,
				toRecipient: createWrap(createSeal(rumor, secretKey, recipient), recipient),
				toSelf: createWrap(createSeal(rumor, secretKey, me), me)
			};
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
