// Língua da interface (ADR-0008). Os textos vêm de `m` (Paraglide, messages/*.json); aqui fica a língua
// ativa, reativa: o layout redesenha tudo ao trocar, sem recarregar a página (recarregar tranca o cofre).
import type { IconName } from '#lib/components/Icon.svelte';
import { getLocale, setLocale, type Locale } from '#lib/paraglide/runtime.js';

export const language = $state({ current: getLocale() });

export function changeLanguage(locale: Locale) {
	setLocale(locale, { reload: false });
	language.current = locale;
	document.documentElement.lang = locale;
}

/** Localidade para `Intl`, `localeCompare` e `toLocaleUpperCase` (RNF-72): a mesma da interface. */
export const intlLocale = (): string => language.current;

/** Marca de ícone para a variável de uma frase traduzida (`{relogio}`); o `Rich` desenha o ícone no lugar. */
export const iconMark = (name: IconName) => `@@${name}@@`;

export type RichPart = { text: string; bold: boolean; icon?: undefined } | { icon: IconName };

/**
 * Trechos de uma frase traduzida: em negrito, marcados com **assim**, e ícones (`iconMark`). A frase fica
 * inteira para quem traduz, sem HTML no arquivo de mensagens.
 */
export const richParts = (text: string): RichPart[] =>
	text
		.split(/(\*\*.+?\*\*|@@[\w-]+@@)/)
		.filter(Boolean)
		.map((part) =>
			part.startsWith('@@')
				? { icon: part.slice(2, -2) as IconName }
				: part.startsWith('**')
					? { text: part.slice(2, -2), bold: true }
					: { text: part, bold: false }
		);
