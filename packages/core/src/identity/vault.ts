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
	10050, // relays onde recebo mensagens (NIP-17)
	24242 // autorização de envio a servidor Blossom (BUD-01/02)
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

/** Mensagem de grupo embrulhada: um gift wrap por membro, mais a minha cópia. */
export type WrappedGroupMessage = { rumor: Rumor; toRecipients: { recipient: string; wrap: NostrEvent }[]; toSelf: NostrEvent };

export const MAX_TEXT_LENGTH = 4000;

/** Reação (NIP-25) e confirmação de entrega/leitura (kind próprio, docs/06 §3.4); o 4441 sai da faixa 4440–4449 reservada. */
export const REACTION_KIND = 7;
export const RECEIPT_KIND = 4441;
/** Cartão de perfil (contacts/profile.ts, Q-P5). */
export const PROFILE_KIND = 4442;
/** Edição de mensagem (conversations/edits.ts, RF-24). */
export const EDIT_KIND = 4443;
/** Confirmações agrupadas: um evento cobre várias mensagens, mas não um número sem fim. */
export const MAX_RECEIPT_IDS = 200;
export const MAX_REACTION_LENGTH = 16;

/** Tipos de rumor que o app escreve. */
export type MessageKind = 14 | 15 | 5 | typeof REACTION_KIND | typeof RECEIPT_KIND | typeof PROFILE_KIND | typeof EDIT_KIND;

/** Membros de grupo além de mim que recebem um embrulho; 20 cobre os 19 outros membros e alguém que acabou de sair (RF-30). */
const MAX_GROUP_RECIPIENTS = 20;

const isPublicKey = (v: string) => /^[0-9a-f]{64}$/.test(v);

/** Regras comuns a mensagens 1:1 e de grupo: o cofre não embrulha qualquer coisa. */
function checkMessage(kind: number, content: string, tags: string[][]) {
	if (kind === 14 && (!content.trim() || content.length > MAX_TEXT_LENGTH)) throw new Error('mensagem vazia ou longa demais');
	if (kind === 15 && !/^https:\/\/\S+$/.test(content)) throw new Error('arquivo sem endereço https');
	if (kind === 5 && !tags.some((t) => t[0] === 'e')) throw new Error('pedido de apagar sem a mensagem');
	if (kind === REACTION_KIND) {
		if (!content.trim() || [...content].length > MAX_REACTION_LENGTH) throw new Error('reação vazia ou longa demais');
		if (tags.filter((t) => t[0] === 'e').length !== 1) throw new Error('reação sem a mensagem');
	}
	if (kind === RECEIPT_KIND) {
		const ids = tags.filter((t) => t[0] === 'e').length;
		if (ids === 0 || ids > MAX_RECEIPT_IDS) throw new Error('confirmação sem mensagens ou com mensagens demais');
		if (!tags.some((t) => t[0] === 'status' && (t[1] === 'entregue' || t[1] === 'lida'))) throw new Error('confirmação sem o estado');
	}
	if (kind === EDIT_KIND) {
		if (!content.trim() || content.length > MAX_TEXT_LENGTH) throw new Error('edição vazia ou longa demais');
		if (tags.filter((t) => t[0] === 'e').length !== 1) throw new Error('edição sem a mensagem');
	}
	if (kind === PROFILE_KIND && !tags.some((t) => t[0] === 'nome' && t[1]?.trim())) throw new Error('cartão de perfil sem nome');
}

/**
 * Sessão aberta: a chave privada cifrada com uma chave AES não exportável, que o
 * app guarda no aparelho para recarregar a página sem pedir o PIN de novo. Nem o
 * código do app consegue ler a chave AES, só usá-la; quem copia os dados do
 * navegador consegue (T15, já aceito no PWA). `lastSeen` é quando o app saiu da tela.
 */
export type OpenSession = { key: CryptoKey; iv: Uint8Array<ArrayBuffer>; ciphertext: Uint8Array<ArrayBuffer>; lastSeen: number };

/** Sem uso por mais que isto, o PIN volta a ser pedido. */
export const SESSION_IDLE_MS = 5 * 60_000;

/** A sessão ainda vale? Um `lastSeen` no futuro (relógio mexido) não vale. */
export function sessionIsOpen(session: OpenSession, now: number): boolean {
	return session.lastSeen <= now && now - session.lastSeen < SESSION_IDLE_MS;
}

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
		 * Embrulha uma mensagem 1:1 (NIP-17): kind 14 (texto) ou 15 (arquivo, com a URL
		 * no conteúdo e a chave nas tags). Um gift wrap vai para o destinatário e outro
		 * para mim, que vira minha cópia em outros aparelhos. `extraTags` leva as tags
		 * do app (ex.: ["nome", …] na primeira mensagem; as do arquivo no kind 15).
		 * `createdAt` vem de `sendTime`, para não empatar com a mensagem anterior.
		 */
		wrapDirectMessage(
			recipient: string,
			content: string,
			extraTags: string[][] = [],
			kind: MessageKind = 14,
			createdAt?: number
		): WrappedMessage {
			if (!secretKey) throw new LockedError();
			if (!isPublicKey(recipient)) throw new Error('destinatário inválido');
			checkMessage(kind, content, extraTags);
			const rumor = createRumor(
				{ kind, content, tags: [['p', recipient], ...extraTags], ...(createdAt !== undefined ? { created_at: createdAt } : {}) },
				secretKey
			) as Rumor;
			const me = getPublicKey(secretKey);
			return {
				rumor,
				toRecipient: createWrap(createSeal(rumor, secretKey, recipient), recipient),
				toSelf: createWrap(createSeal(rumor, secretKey, me), me)
			};
		},

		/**
		 * Embrulha uma mensagem de grupo (docs/06 §3.3): o rumor leva a tag `g` e um `p` por
		 * destinatário, e cada um recebe o seu gift wrap. Também os avisos de grupo (kind 4440),
		 * com `createdAt` igual ao horário de entrada dos membros novos.
		 */
		wrapGroupMessage(
			recipients: string[],
			content: string,
			tags: string[][],
			kind: MessageKind | 4440 = 14,
			createdAt?: number
		): WrappedGroupMessage {
			if (!secretKey) throw new LockedError();
			const me = getPublicKey(secretKey);
			const unique = [...new Set(recipients)].filter((r) => r !== me);
			if (!unique.every(isPublicKey) || unique.length > MAX_GROUP_RECIPIENTS) throw new Error('destinatários inválidos');
			if (!tags.some((t) => t[0] === 'g')) throw new Error('mensagem de grupo sem a tag g');
			if (kind === 4440 && !tags.some((t) => t[0] === 'acao')) throw new Error('aviso de grupo sem ação');
			checkMessage(kind, content, tags);
			const rumor = createRumor(
				{ kind, content, tags: [...unique.map((r) => ['p', r]), ...tags], ...(createdAt !== undefined ? { created_at: createdAt } : {}) },
				secretKey
			) as Rumor;
			return {
				rumor,
				toRecipients: unique.map((recipient) => ({ recipient, wrap: createWrap(createSeal(rumor, secretKey!, recipient), recipient) })),
				toSelf: createWrap(createSeal(rumor, secretKey, me), me)
			};
		},

		/**
		 * Embrulha de novo um aviso de grupo que eu mesmo fiz, para quem não o recebeu
		 * (repasse, groups.ts). O rumor é o original: o horário e o id não mudam.
		 */
		rewrapGroupControl(rumor: Rumor, recipients: string[]): { recipient: string; wrap: NostrEvent }[] {
			if (!secretKey) throw new LockedError();
			if (rumor.pubkey !== getPublicKey(secretKey) || rumor.kind !== 4440 || getEventHash(rumor) !== rumor.id) {
				throw new Error('só repasso avisos de grupo meus');
			}
			if (!recipients.every(isPublicKey)) throw new Error('destinatários inválidos');
			return recipients.map((recipient) => ({ recipient, wrap: createWrap(createSeal(rumor, secretKey!, recipient), recipient) }));
		},

		/** Guarda a chave desbloqueada numa sessão (ver OpenSession). */
		async openSession(now: number): Promise<OpenSession> {
			if (!secretKey) throw new LockedError();
			const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
			const iv = crypto.getRandomValues(new Uint8Array(12));
			const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new Uint8Array(secretKey)));
			return { key, iv, ciphertext, lastSeen: now };
		},

		/** Desbloqueia por uma sessão aberta, sem PIN. Devolve a chave pública. */
		async resumeSession(session: OpenSession): Promise<string> {
			const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: session.iv }, session.key, session.ciphertext);
			secretKey = new Uint8Array(raw);
			return getPublicKey(secretKey);
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
