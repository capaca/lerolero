// Cartão de perfil privado (Q-P5, RF-02): nome, foto, relays de DM e versão do app, cifrados e embrulhados como
// uma mensagem (docs/06 §3.5). Não há perfil público (kind 0): só quem conversa comigo recebe o cartão, junto da
// minha primeira mensagem e de novo quando algo muda.

import { PROFILE_KIND, type Rumor } from '../identity/vault.ts';
import { exclusive } from '../conversations/lock.ts';
import { mediaFromRumor, mediaTags, NAME_TAG } from '../conversations/messaging.ts';
import type { Storage } from '../storage/repositories.ts';
import type { ProfileRecord } from '../storage/records.ts';
import { cleanName } from './invite.ts';

/** O que este app sabe ler (RNF-93): quem recebe o cartão pode deixar de mandar o que eu não entendo. */
export const PROFILE_FEATURES = ['texto', 'audio', 'foto', 'reacao', 'confirmacao', 'grupo', 'cartao'];

const MAX_RELAYS = 3;
const MAX_FEATURES = 32;
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Quem eu já mandei o cartão, e em qual versão (o `updatedAt` do meu cartão). */
const SENT_KEY = 'cartaoEnviadoA';

/** Tags e conteúdo do meu cartão; com foto, o conteúdo é o endereço dela, como no kind 15. */
export function profileEvent(card: Omit<ProfileRecord, 'publicKey' | 'updatedAt'>): { content: string; tags: string[][] } {
	const tags = [
		['v', '1'],
		[NAME_TAG, cleanName(card.name)],
		...card.relays.slice(0, MAX_RELAYS).map((r) => ['relay', r]),
		...(card.app ? [['app', card.app]] : []),
		...card.features.map((f) => ['recurso', f]),
		...(card.photo ? mediaTags(card.photo) : []),
		['alt', 'cartão de perfil do Lero-lero']
	];
	return { content: card.photo?.urls[0] ?? '', tags };
}

/** Lê um cartão que chegou (dado de fora: tudo conferido); undefined se não tem nome. */
export function profileFromRumor(rumor: Rumor): ProfileRecord | undefined {
	if (rumor.kind !== PROFILE_KIND) return undefined;
	const name = cleanName(rumor.tags.find((t) => t[0] === NAME_TAG)?.[1] ?? '');
	if (!name) return undefined;
	const photo = rumor.content ? mediaFromRumor(rumor) : undefined;
	const app = rumor.tags.find((t) => t[0] === 'app')?.[1];
	return {
		publicKey: rumor.pubkey,
		name,
		...(photo && PHOTO_TYPES.has(photo.type) ? { photo } : {}),
		relays: rumor.tags.filter((t) => t[0] === 'relay' && /^wss:\/\/\S+$/.test(t[1] ?? '')).map((t) => t[1]).slice(0, MAX_RELAYS),
		...(app && /^[\w.+-]{1,32}$/.test(app) ? { app } : {}),
		features: rumor.tags
			.filter((t) => t[0] === 'recurso' && /^[a-z0-9-]{1,24}$/.test(t[1] ?? ''))
			.map((t) => t[1])
			.slice(0, MAX_FEATURES),
		updatedAt: rumor.created_at
	};
}

/**
 * Guarda o cartão de alguém, se for mais novo que o que já tenho. O nome vai para o contato como o escolhido por
 * ele (o que eu dei continua valendo, RF-14) e para os grupos em que ele está; os relays passam a ser onde eu o
 * procuro. De quem não é contato, o cartão fica só guardado: não vira pedido de mensagem (T7). Bloqueado: descartado.
 */
async function storeProfileNow(storage: Storage, me: string, rumor: Rumor): Promise<ProfileRecord | undefined> {
	if (rumor.pubkey === me) return undefined;
	const card = profileFromRumor(rumor);
	if (!card) return undefined;
	const contact = await storage.contacts.get(card.publicKey);
	if (contact?.state === 'bloqueado') return undefined;
	const known = await storage.profiles.get(card.publicKey);
	if (known && known.updatedAt >= card.updatedAt) return undefined;
	await storage.profiles.put(card);
	if (contact && (contact.chosenName !== card.name || (card.relays.length && card.relays.join(' ') !== contact.dmRelays.join(' ')))) {
		await storage.contacts.put({ ...contact, chosenName: card.name, dmRelays: card.relays.length ? card.relays : contact.dmRelays });
	}
	for (const conversation of await storage.conversations.listByRecent()) {
		const group = conversation.group;
		if (!group?.everMembers.includes(card.publicKey) || group.names[card.publicKey] === card.name) continue;
		await storage.conversations.put({ ...conversation, group: { ...group, names: { ...group.names, [card.publicKey]: card.name } } });
	}
	return card;
}

export const storeProfile = (...args: Parameters<typeof storeProfileNow>) => exclusive(args[0], () => storeProfileNow(...args));

/** Quem está comigo num grupo de que participo (grupo que ainda é pedido não conta, T7). */
async function groupMates(storage: Storage): Promise<Set<string>> {
	const mates = new Set<string>();
	for (const c of await storage.conversations.listByRecent()) {
		if (c.group?.amMember && !c.group.request) c.members.forEach((p) => mates.add(p));
	}
	return mates;
}

/**
 * Quem recebe o meu cartão quando ele muda: quem já recebeu algum, os contatos com quem já falei no 1:1 e os
 * membros dos grupos em que estou. Pedido não aceito fica de fora (T7), a não ser que esteja num grupo comigo.
 */
export async function profileAudience(storage: Storage, me: string): Promise<string[]> {
	const sent = (await storage.settings.get<Record<string, number>>(SENT_KEY)) ?? {};
	const mates = await groupMates(storage);
	const people = new Set([...Object.keys(sent), ...mates]);
	for (const c of await storage.conversations.listByRecent()) {
		if (c.type === 'direta' && c.nameSent) c.members.forEach((p) => people.add(p));
	}
	people.delete(me);
	const audience: string[] = [];
	for (const person of people) {
		const state = (await storage.contacts.get(person))?.state;
		if (state === 'bloqueado' || (state === 'pedido' && !mates.has(person))) continue;
		audience.push(person);
	}
	return audience;
}

/** Dos destinatários, quem ainda não tem a versão atual do meu cartão. */
export async function profileDue(storage: Storage, recipients: string[], version: number): Promise<string[]> {
	const sent = (await storage.settings.get<Record<string, number>>(SENT_KEY)) ?? {};
	return recipients.filter((r) => (sent[r] ?? 0) < version);
}

/** O cartão já está na fila para estes destinatários. */
export async function markProfileSent(storage: Storage, recipients: string[], version: number) {
	await exclusive(storage, async () => {
		const sent = (await storage.settings.get<Record<string, number>>(SENT_KEY)) ?? {};
		for (const r of recipients) sent[r] = Math.max(sent[r] ?? 0, version);
		await storage.settings.set(SENT_KEY, sent);
	});
}

/**
 * A foto de alguém aparece só para contato aceito ou quem está num grupo comigo: de quem só mandou pedido, não
 * (decidido em 2026-10-29, T9: a foto de um conhecido usada por um golpista não ajuda a enganar antes do aceite).
 */
export async function photoAllowed(storage: Storage, me: string, publicKey: string): Promise<boolean> {
	if (publicKey === me) return true;
	const state = (await storage.contacts.get(publicKey))?.state;
	if (state === 'aceito') return true;
	if (state === 'bloqueado') return false;
	return (await groupMates(storage)).has(publicKey);
}
