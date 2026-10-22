// Contatos (RF-10, RF-11, RF-14). O nome que a pessoa dá ao contato prevalece sobre o
// nome que o contato escolheu para si: um golpista pode se chamar "Mãe" no convite,
// mas na lista aparece o nome que você escreveu ao adicionar.

import type { ContactRepository } from '../storage/repositories.ts';
import type { ContactRecord } from '../storage/records.ts';
import { toNpub } from '../identity/npub.ts';
import { cleanName, type Invite } from './invite.ts';

export class SelfInviteError extends Error {
	constructor() {
		super('Este é o seu próprio convite');
		this.name = 'SelfInviteError';
	}
}

/** Nome para mostrar: o local; senão o escolhido pelo contato; senão o começo da chave. */
export function contactName(contact: Pick<ContactRecord, 'localName' | 'chosenName' | 'publicKey'>): string {
	return contact.localName || contact.chosenName || `${toNpub(contact.publicKey).slice(0, 12)}…`;
}

/**
 * Adiciona a partir de um convite, ou atualiza se já existe: relays e nome escolhido
 * vêm do convite (podem ter mudado); o nome local só muda se um novo for dado.
 */
export async function addContact(
	repo: ContactRepository,
	invite: Invite,
	options: { myPublicKey: string; localName?: string; now?: number }
): Promise<ContactRecord> {
	if (invite.publicKey === options.myPublicKey) throw new SelfInviteError();
	const existing = await repo.get(invite.publicKey);
	const localName = options.localName !== undefined ? cleanName(options.localName) || undefined : existing?.localName;
	const contact: ContactRecord = {
		publicKey: invite.publicKey,
		localName,
		chosenName: invite.name ?? existing?.chosenName,
		// adicionar de propósito aceita, inclusive quem estava como pedido de mensagem
		state: existing?.state === 'bloqueado' ? 'bloqueado' : 'aceito',
		dmRelays: invite.relays.length > 0 ? invite.relays : (existing?.dmRelays ?? []),
		addedAt: existing?.addedAt ?? options.now ?? Date.now()
	};
	await repo.put(contact);
	return contact;
}

export async function renameContact(repo: ContactRepository, publicKey: string, localName: string): Promise<ContactRecord> {
	const contact = await repo.get(publicKey);
	if (!contact) throw new Error('Contato não encontrado');
	const updated = { ...contact, localName: cleanName(localName) || undefined };
	await repo.put(updated);
	return updated;
}

/** Contatos aceitos em ordem alfabética do nome mostrado. */
export async function listContacts(repo: ContactRepository): Promise<ContactRecord[]> {
	const all = await repo.list();
	return all
		.filter((c) => c.state === 'aceito')
		.sort((a, b) => contactName(a).localeCompare(contactName(b), 'pt-BR', { sensitivity: 'base' }));
}
