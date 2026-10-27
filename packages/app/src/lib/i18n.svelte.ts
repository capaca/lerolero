// Língua da interface (ADR-0008). Os textos vêm de `m` (Paraglide, messages/*.json); aqui fica a língua
// ativa, reativa: o layout redesenha tudo ao trocar, sem recarregar a página (recarregar tranca o cofre).
import { getLocale, setLocale, type Locale } from '#lib/paraglide/runtime.js';

export const language = $state({ current: getLocale() });

export function changeLanguage(locale: Locale) {
	setLocale(locale, { reload: false });
	language.current = locale;
	document.documentElement.lang = locale;
}

/** Localidade para `Intl`, `localeCompare` e `toLocaleUpperCase` (RNF-72): a mesma da interface. */
export const intlLocale = (): string => language.current;

/**
 * Trechos em negrito dentro de uma frase traduzida, marcados com **assim**: a frase fica inteira para quem
 * traduz, sem HTML no arquivo de mensagens.
 */
export const boldParts = (text: string) => text.split(/\*\*(.+?)\*\*/).map((part, i) => ({ text: part, bold: i % 2 === 1 }));
