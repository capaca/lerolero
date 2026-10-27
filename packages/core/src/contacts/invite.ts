// Convite (QR e link, RF-10 e RF-11): chave pública e nome de quem convida (docs/06 §2).
//
// Formato: <endereço do app>/convite#<npub>&n=<nome>
// - npub (NIP-19) é a chave pública no padrão do Nostr: outros apps entendem;
// - os relays de DM não vão no link (ficaria com ~330 caracteres): quem recebe busca
//   o kind 10050 que o app publica, com a lista padrão de reserva;
// - links antigos com nprofile (chave + relays) continuam valendo;
// - o nome vai à parte, e tudo depois do # fica no aparelho: o servidor não vê.
// O QR contém o próprio link, então a câmera comum do celular também abre o app.

import { decode, npubEncode } from 'nostr-tools/nip19';

export type Invite = { publicKey: string; name?: string; relays: string[] };

/** O que há de errado no convite; a interface monta o texto (ADR-0008). */
export type InviteProblem = { reason: 'formato' } | { reason: 'nao-e-pessoa' };

export class InvalidInviteError extends Error {
	constructor(
		message = 'Convite inválido',
		readonly detail?: InviteProblem
	) {
		super(message);
		this.name = 'InvalidInviteError';
	}
}

const MAX_NAME = 40;
const MAX_RELAYS = 3;

/** Nome vindo de fora: sem caracteres de controle, espaços normais e tamanho limitado. */
export function cleanName(name: string): string {
	return name
		.replace(/[\p{Cc}\p{Cf}]/gu, '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, MAX_NAME);
}

const onlyWss = (relays: string[]) => relays.filter((r) => /^wss:\/\/[^\s]+$/.test(r)).slice(0, MAX_RELAYS);

/** `appUrl` é o endereço do app, terminado em barra (ex.: https://capaca.github.io/lerolero/). */
export function inviteLink(appUrl: string, invite: Pick<Invite, 'publicKey' | 'name'>): string {
	const name = invite.name ? `&n=${encodeURIComponent(cleanName(invite.name))}` : '';
	return `${appUrl}convite#${npubEncode(invite.publicKey)}${name}`;
}

/**
 * Lê um convite colado ou escaneado. Aceita o link do app, o trecho depois do #,
 * um nprofile ou npub soltos (de outros apps Nostr) e o prefixo "nostr:".
 */
export function parseInvite(text: string): Invite {
	let input = text.trim();
	const hash = input.indexOf('#');
	if (hash >= 0) input = input.slice(hash + 1);
	input = input.replace(/^nostr:/i, '');

	const [code, ...params] = input.split('&');
	const name = params.find((p) => p.startsWith('n='))?.slice(2);

	let decoded: ReturnType<typeof decode>;
	try {
		decoded = decode(code);
	} catch {
		throw new InvalidInviteError('Este não parece ser um convite do Lero-lero', { reason: 'formato' });
	}

	let invite: Invite;
	if (decoded.type === 'nprofile') {
		invite = { publicKey: decoded.data.pubkey, relays: onlyWss(decoded.data.relays ?? []) };
	} else if (decoded.type === 'npub') {
		invite = { publicKey: decoded.data, relays: [] };
	} else {
		throw new InvalidInviteError('Este código não é de uma pessoa', { reason: 'nao-e-pessoa' });
	}

	if (name) {
		let decodedName: string;
		try {
			decodedName = decodeURIComponent(name);
		} catch {
			decodedName = name;
		}
		const clean = cleanName(decodedName);
		if (clean) invite.name = clean;
	}
	return invite;
}
