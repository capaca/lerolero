// Endereços de páginas dentro do texto das mensagens (T18). Só `http` e `https` viram link; nada de `javascript:`,
// `data:` ou afins. O app nunca busca a página (sem prévia): quem toca é que abre, numa aba nova.

export type TextPart = { text: string } | { text: string; href: string; host: string };

const CANDIDATE = /(?:https?:\/\/|www\.)[^\s<>]+/giu;
/** pontuação do fim da frase que não faz parte do endereço */
const TRAILING = /[.,;:!?'"”’»]+$/u;
const PAIRS: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
const MAX_SHOWN = 50;

/** Tira do fim o que é da frase: pontuação e fecha-parênteses que não abriram dentro do endereço. */
function trimEnd(candidate: string): string {
	let text = candidate;
	for (;;) {
		const trimmed = text.replace(TRAILING, '');
		const last = trimmed.at(-1);
		const unbalanced = last !== undefined && last in PAIRS && count(trimmed, last) > count(trimmed, PAIRS[last]);
		const next = unbalanced ? trimmed.slice(0, -1) : trimmed;
		if (next === text) return text;
		text = next;
	}
}

const count = (text: string, char: string) => text.split(char).length - 1;

/**
 * O que aparece no lugar do endereço: o domínio sempre inteiro (é nele que o golpe do endereço parecido se esconde,
 * T9) e o resto encurtado só na tela. O link em si segue completo.
 */
function shown(url: URL): string {
	const rest = (url.pathname === '/' ? '' : url.pathname) + url.search + url.hash;
	const room = Math.max(MAX_SHOWN - url.host.length, 0);
	return rest.length > room ? `${url.host}${rest.slice(0, room)}…` : url.host + rest;
}

function toLink(candidate: string): { text: string; href: string; host: string } | undefined {
	const text = trimEnd(candidate);
	let url: URL;
	try {
		url = new URL(/^www\./iu.test(text) ? `https://${text}` : text);
	} catch {
		return undefined;
	}
	// `https://banco.com@outro.com` mostraria um domínio e abriria outro
	if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password || !url.hostname.includes('.')) {
		return undefined;
	}
	return { text: shown(url), href: url.href, host: url.host };
}

/** Parte o texto em pedaços de texto comum e de link, na ordem; juntando os `text` de pedaços sem link, nada se perde. */
export function splitLinks(text: string): TextPart[] {
	const parts: TextPart[] = [];
	let from = 0;
	const plain = (to: number) => {
		if (to > from) parts.push({ text: text.slice(from, to) });
	};
	for (const match of text.matchAll(CANDIDATE)) {
		const link = toLink(match[0]);
		if (!link) continue;
		const candidate = trimEnd(match[0]);
		plain(match.index);
		parts.push(link);
		from = match.index + candidate.length;
	}
	plain(text.length);
	return parts;
}
