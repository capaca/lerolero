// Prova de trabalho (NIP-13; RF-90, T8): um pequeno custo para quem escreve a quem ainda não o conhece. Roda no
// worker do cofre (RNF-18: < 1 s no aparelho de referência). SHA-256 em WASM (hash-wasm, já usado no Argon2):
// no Mac, 65 mil tentativas sobre um embrulho de 1,5 KB levam ~0,45 s, contra ~0,75 s em JavaScript.

import { createSHA256, type IHasher } from 'hash-wasm';

/**
 * Dificuldade em bits (decidido em 2026-10-29 pela medição no Motorola Edge 60 do Pedro, 10 provas cada): 12 bits,
 * média 61 ms (pior 178 ms); 14 bits, 196 ms (806 ms); 16 bits, 870 ms (4,9 s). Cada bit dobra o trabalho; num 2 GB,
 * 2 a 3 vezes mais lento, 14 bits ainda fica perto da meta.
 */
export const POW_DIFFICULTY = 14;

/** Bits zero no começo de um id (hex), como o NIP-13 conta. */
export function powOf(id: string): number {
	let bits = 0;
	for (const char of id) {
		const nibble = parseInt(char, 16);
		if (nibble === 0) bits += 4;
		else return bits + Math.clz32(nibble) - 28;
	}
	return bits;
}

type Unsigned = { pubkey: string; created_at: number; kind: number; tags: string[][]; content: string };

let hasher: Promise<IHasher> | undefined;
// não aparece em conteúdo base64 nem em tags hex
const MARK = 'NONCE_A_PREENCHER';

/**
 * Acha um nonce para o evento chegar à dificuldade e devolve as tags com ele. Mantém o `created_at`: no gift wrap ele
 * é sorteado de propósito (NIP-59), e o `minePow` do nostr-tools o trocaria pela hora atual, revelando quando saiu.
 */
export async function mine(event: Unsigned, difficulty: number): Promise<string[][]> {
	const h = await (hasher ??= createSHA256());
	const tags = [...event.tags, ['nonce', MARK, String(difficulty)]];
	const [before, after] = JSON.stringify([0, event.pubkey, event.created_at, event.kind, tags, event.content]).split(MARK);
	const encoder = new TextEncoder();
	const head = encoder.encode(before);
	const tail = encoder.encode(after);
	for (let nonce = 0; ; nonce++) {
		h.init();
		h.update(head);
		h.update(String(nonce));
		h.update(tail);
		if (leadingZeros(h.digest('binary')) >= difficulty) return [...event.tags, ['nonce', String(nonce), String(difficulty)]];
	}
}

function leadingZeros(hash: Uint8Array): number {
	let bits = 0;
	for (const byte of hash) {
		if (byte === 0) bits += 8;
		else return bits + Math.clz32(byte) - 24;
	}
	return bits;
}
