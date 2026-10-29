// Frase de recuperação: BIP-39, 12 palavras, lista oficial em português (docs/06 §2).
// Na lista portuguesa nenhuma palavra tem acento e as 4 primeiras letras já
// identificam a palavra, o que permite aceitar digitação imprecisa e completar.

import { generateMnemonic, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/portuguese.js';

export const PHRASE_LENGTH = 12;

/** O que há de errado na frase; a interface monta o texto (ADR-0008). `position` começa em 1. */
export type PhraseProblem =
	| { reason: 'tamanho'; count: number }
	| { reason: 'palavra'; position: number; word: string }
	| { reason: 'soma' };

export class InvalidPhraseError extends Error {
	constructor(
		message = 'Frase de recuperação inválida',
		readonly detail?: PhraseProblem
	) {
		super(message);
		this.name = 'InvalidPhraseError';
	}
}

export function generatePhrase(): string[] {
	return generateMnemonic(wordlist, 128).split(' ');
}

/** Minúsculas, sem acento e sem espaços: "Fôlgado " vira "folgado". */
export function normalizeWord(input: string): string {
	return input
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.trim();
}

/** Palavra da lista que corresponde ao que foi digitado (completa a partir de 4 letras). */
export function matchWord(input: string): string | undefined {
	const w = normalizeWord(input);
	if (w.length === 0) return undefined;
	if (wordlist.includes(w)) return w;
	if (w.length < 4) return undefined;
	const candidates = wordlist.filter((candidate) => candidate.startsWith(w));
	return candidates.length === 1 ? candidates[0] : undefined;
}

/** Sugestões para o campo de digitação (até `limit`). */
export function suggestWords(input: string, limit = 4): string[] {
	const w = normalizeWord(input);
	if (w.length < 2) return [];
	return wordlist.filter((candidate) => candidate.startsWith(w)).slice(0, limit);
}

/** Converte o que foi digitado em palavras da lista e confere o dígito verificador. */
export function parsePhrase(input: string | string[]): string[] {
	const parts = (Array.isArray(input) ? input : input.split(/\s+/)).filter((p) => p.trim() !== '');
	if (parts.length !== PHRASE_LENGTH) {
		throw new InvalidPhraseError(`A frase tem ${PHRASE_LENGTH} palavras; foram digitadas ${parts.length}`, {
			reason: 'tamanho',
			count: parts.length
		});
	}
	const words = parts.map((part, i) => {
		const word = matchWord(part);
		if (!word) {
			throw new InvalidPhraseError(`A ${i + 1}ª palavra ("${part.trim()}") não está na lista`, {
				reason: 'palavra',
				position: i + 1,
				word: part.trim()
			});
		}
		return word;
	});
	if (!validateMnemonic(words.join(' '), wordlist)) {
		throw new InvalidPhraseError('As palavras existem, mas a frase não confere. Verifique a ordem e se alguma foi trocada', {
			reason: 'soma'
		});
	}
	return words;
}

/** Sorteia `count` posições diferentes (0 a 11) para o teste de verificação (RF-03), em ordem. */
export function pickCheckPositions(count = 2): number[] {
	const positions = new Set<number>();
	const random = new Uint32Array(1);
	while (positions.size < count) {
		crypto.getRandomValues(random);
		positions.add(random[0] % PHRASE_LENGTH);
	}
	return [...positions].sort((a, b) => a - b);
}

// Arquivo e link de recuperação (RF-09 a, ADR-0009 D2). O texto do arquivo é traduzido (ADR-0008); daqui saem só
// as partes que a leitura precisa achar em qualquer idioma: o fragmento do link e a lista "1. palavra".

/** Fragmento do link de restauração: as palavras no `#`, que o navegador não manda ao servidor (T21). */
export const recoveryFragment = (words: string[]) => '#' + words.join('-');

/** As palavras de um fragmento `#palavra-palavra-…`, ou nada se não for uma frase válida. */
export function phraseFromFragment(hash: string): string[] | undefined {
	try {
		return parsePhrase(decodeURIComponent(hash.replace(/^#/, '')).split('-'));
	} catch {
		return undefined;
	}
}

/** Lista numerada das palavras, do jeito que o arquivo e o cartão a mostram. */
export const numberedWords = (words: string[]) => words.map((w, i) => `${i + 1}. ${w}`).join('\n');

/**
 * As palavras de um arquivo de recuperação: pelo link, se estiver inteiro, ou pela lista numerada, que
 * sobrevive à mudança de domínio e a quem editou o arquivo à mão.
 */
export function phraseFromRecoveryText(text: string): string[] | undefined {
	for (const [, fragment] of text.matchAll(/\/restaurar(#[\p{L}-]+)/gu)) {
		const words = phraseFromFragment(fragment!);
		if (words) return words;
	}
	const numbered: string[] = [];
	for (const [, position, word] of text.matchAll(/^\s*(\d{1,2})[.)º]?\s+(\p{L}+)\s*$/gmu)) {
		numbered[Number(position) - 1] = word!;
	}
	try {
		return parsePhrase(numbered.slice(0, PHRASE_LENGTH).filter(Boolean));
	} catch {
		return undefined;
	}
}
