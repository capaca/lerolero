// Lacra dados com o PIN: Argon2id transforma o PIN numa chave e o AES-GCM cifra
// (docs/06-protocolo-e-dados.md §2). Roda no Web Worker: o Argon2id é lento de propósito.

import { argon2id } from 'hash-wasm';

export type KdfParams = { memoryKiB: number; iterations: number; parallelism: number };

/**
 * Provisório até medir no aparelho de referência (meta: ~1 s). O mínimo da OWASP
 * (19 MiB, 2 iterações) levou 60 ms num celular intermediário; isto custa cerca
 * de 2,5 vezes mais. Os parâmetros ficam guardados em cada lacre, então mudar
 * aqui não invalida o que já foi lacrado.
 */
export const DEFAULT_KDF: KdfParams = { memoryKiB: 32 * 1024, iterations: 3, parallelism: 1 };

// bytes num ArrayBuffer comum (não compartilhado), como o Web Crypto exige
type Bytes = Uint8Array<ArrayBuffer>;

export type Sealed = {
	ciphertext: Bytes;
	iv: Bytes;
	salt: Bytes;
	kdf: KdfParams;
};

export class WrongPinError extends Error {
	constructor() {
		super('PIN incorreto');
		this.name = 'WrongPinError';
	}
}

async function deriveKey(pin: string, salt: Bytes, kdf: KdfParams): Promise<CryptoKey> {
	const raw = await argon2id({
		password: pin,
		salt,
		memorySize: kdf.memoryKiB,
		iterations: kdf.iterations,
		parallelism: kdf.parallelism,
		hashLength: 32,
		outputType: 'binary'
	});
	// o hash-wasm devolve bytes de tipo genérico; a cópia garante um ArrayBuffer comum
	return crypto.subtle.importKey('raw', new Uint8Array(raw), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function seal(data: Bytes, pin: string, kdf: KdfParams = DEFAULT_KDF): Promise<Sealed> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const key = await deriveKey(pin, salt, kdf);
	const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
	return { ciphertext, iv, salt, kdf };
}

/** Abre o lacre; lança WrongPinError se o PIN não confere (o AES-GCM detecta). */
export async function unseal(sealed: Sealed, pin: string): Promise<Bytes> {
	const key = await deriveKey(pin, sealed.salt, sealed.kdf);
	try {
		return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv }, key, sealed.ciphertext));
	} catch {
		throw new WrongPinError();
	}
}
