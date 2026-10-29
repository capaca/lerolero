// Mencionar alguém no grupo (RF-35): o texto leva `nostr:npub1…` (NIP-27), a chave da pessoa e não o nome, para cada
// um ver o nome que conhece (o do contato, ou "~Nome"). Outros apps Nostr entendem o mesmo formato.

import { decode } from 'nostr-tools/nip19';
import { toNpub } from '../identity/npub.ts';

export type MentionPart = { text: string } | { text: string; mention: string };

const MENTION = /nostr:(npub1[02-9ac-hj-np-z]{58})/g;

/** O que vai no texto no lugar do nome. */
export const mentionOf = (publicKey: string) => `nostr:${toNpub(publicKey)}`;

function publicKeyOf(npub: string): string | undefined {
	try {
		const decoded = decode(npub);
		return decoded.type === 'npub' ? decoded.data : undefined;
	} catch {
		return undefined;
	}
}

/** Parte o texto em pedaços comuns e menções, na ordem; uma menção inválida fica como texto. */
export function splitMentions(text: string): MentionPart[] {
	const parts: MentionPart[] = [];
	let from = 0;
	for (const match of text.matchAll(MENTION)) {
		const publicKey = publicKeyOf(match[1]!);
		if (!publicKey) continue;
		if (match.index > from) parts.push({ text: text.slice(from, match.index) });
		parts.push({ text: match[0], mention: publicKey });
		from = match.index + match[0].length;
	}
	if (from < text.length) parts.push({ text: text.slice(from) });
	return parts;
}

/** Quem o texto menciona (sem repetir). */
export const mentionedIn = (text: string): string[] => [...new Set(splitMentions(text).flatMap((p) => ('mention' in p ? [p.mention] : [])))];

/** O texto com cada menção trocada pelo que `label` devolve (ex.: "@Ana"), para prévias e para copiar. */
export const withMentionLabels = (text: string, label: (publicKey: string) => string): string =>
	splitMentions(text)
		.map((p) => ('mention' in p ? label(p.mention) : p.text))
		.join('');
