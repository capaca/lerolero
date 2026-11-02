// Linguagem simples (RNF-64): nenhum jargão técnico nos textos da interface, e um nome só para as 12 palavras.
// Confere o pt-BR.json direto, sem abrir o app; a pseudolíngua do `textos` não enxerga as palavras.
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const textos: Record<string, unknown> = JSON.parse(readFileSync(new URL('../../app/messages/pt-BR.json', import.meta.url), 'utf8'));

const JARGAO = [
	/\brelays?\b/i,
	/\bblossom\b/i,
	/\bnostr\b/i,
	/\bn(pub|sec|profile)1?\b/i,
	/\bNIP\b/,
	/\bhash\b/i,
	/\bchave (privada|secreta)\b/i,
	/\bcifrad[oa]s?\b/i,
	/\boffline\b/i,
	/\bbug\b/i,
	// as 12 palavras se chamam "frase de recuperação" (decidido em 2026-11-02, ADR-0009)
	/\bcódigo\b(?! QR)/i
];

// fora do fluxo padrão: Detalhes técnicos nos Ajustes e a medição que só existe no app em dev
const PERMITIDOS = new Set(['ajustes_chave_dica', 'ajustes_pow_titulo', 'ajustes_pow_dica', 'ajustes_pow_resultado']);

/** Todos os textos de uma mensagem, inclusive as variantes de plural. */
const frases = (valor: unknown): string[] =>
	typeof valor === 'string'
		? [valor]
		: Array.isArray(valor)
			? valor.flatMap(frases)
			: valor && typeof valor === 'object'
				? Object.entries(valor).flatMap(([k, v]) => (k === 'declarations' || k === 'selectors' ? [] : frases(v)))
				: [];

test('os textos da interface não têm jargão técnico', () => {
	const achados = Object.entries(textos)
		.filter(([chave]) => !chave.startsWith('$') && !PERMITIDOS.has(chave))
		.flatMap(([chave, valor]) =>
			frases(valor)
				// "{relays}" é o nome de um valor que entra no texto, não aparece na tela
				.filter((frase) => JARGAO.some((re) => re.test(frase.replace(/\{\w+\}/g, ' '))))
				.map((frase) => `${chave}: ${frase}`)
		);
	expect(achados).toEqual([]);
});
