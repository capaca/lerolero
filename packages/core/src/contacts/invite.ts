// Convite (QR e link, RF-10 e RF-11): chave pública, nome e relays de DM de quem convida,
// para quem recebe poder escrever sem consultar a rede (docs/06 §2).
//
// Formato: <endereço do app>/convite#<nprofile>&n=<nome>
// - nprofile (NIP-19) é o padrão do Nostr para chave + relays: outros apps entendem;
// - o nome vai à parte porque o nprofile não tem campo para ele;
// - tudo depois do # fica no aparelho: o servidor que hospeda o app não vê.
// O QR contém o próprio link, então a câmera comum do celular também abre o app.

import { decode, nprofileEncode } from 'nostr-tools/nip19';

export type Invite = { publicKey: string; name?: string; relays: string[] };

export class InvalidInviteError extends Error {
	constructor(message = 'Convite inválido') {
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
export function inviteLink(appUrl: string, invite: Invite): string {
	const profile = nprofileEncode({ pubkey: invite.publicKey, relays: onlyWss(invite.relays) });
	const name = invite.name ? `&n=${encodeURIComponent(cleanName(invite.name))}` : '';
	return `${appUrl}convite#${profile}${name}`;
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
		throw new InvalidInviteError('Este não parece ser um convite do Lero-lero');
	}

	let invite: Invite;
	if (decoded.type === 'nprofile') {
		invite = { publicKey: decoded.data.pubkey, relays: onlyWss(decoded.data.relays ?? []) };
	} else if (decoded.type === 'npub') {
		invite = { publicKey: decoded.data, relays: [] };
	} else {
		throw new InvalidInviteError('Este código não é de uma pessoa');
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
