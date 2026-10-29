// Backup cifrado (RF-06, docs/06 §3.7): o que a frase sozinha não traz de volta num aparelho novo. Perfil, contatos,
// grupos e alguns ajustes, num evento kind 30078 cifrado para a minha própria chave (vault.sealBackup). Não leva
// mensagens, mídia nem favoritas (decidido em 2026-10-29): texto de conversa nos relays sem prazo ampliaria a T11.

import type { NostrEvent } from 'nostr-tools/pure';
import { BACKUP_D_TAG, BACKUP_KIND } from '../identity/vault.ts';
import { cleanName } from '../contacts/invite.ts';
import { exclusive } from '../conversations/lock.ts';
import { groupConversationId, RESTORED_ACTION } from '../conversations/groups.ts';
import type { RelayPool } from '../net/pool.ts';
import type { Storage } from '../storage/repositories.ts';
import type { ContactRecord, ConversationRecord, GroupInfo, GroupState, MessageMedia } from '../storage/records.ts';

/**
 * Ajustes que valem para a pessoa, não para o aparelho: a confirmação de leitura e os relays onde recebo (sem eles,
 * o aparelho novo sortearia outros e quem já me tem mandaria para os antigos). O tamanho da letra fica por aparelho.
 */
export const BACKUP_SETTINGS = ['confirmacaoLeitura', 'meusRelaysDm'];

/** O que já foi publicado, para não publicar de novo o mesmo conteúdo (dados móveis). */
export const BACKUP_SENT_KEY = 'backupPublicado';
/** Já sei se há backup nos relays (achei e apliquei, ou os relays responderam que não há). Antes disso, não publico. */
export const BACKUP_CHECKED_KEY = 'backupConferido';

/** O id do grupo não fica no GroupInfo, e sim no id da conversa (groupConversationId). */
const GROUP_PREFIX = groupConversationId('');

/** Publica de novo mesmo sem mudança, para o backup não sumir de relay que apaga eventos antigos. */
export const BACKUP_REFRESH_MS = 3 * 24 * 60 * 60 * 1000;

/** O NIP-44 cifra até 65 535 bytes; os pedidos de mensagem já ficam de fora para sobrar espaço. */
const MAX_BACKUP_BYTES = 65_000;

export type BackupContact = Pick<ContactRecord, 'publicKey' | 'localName' | 'chosenName' | 'state' | 'dmRelays' | 'addedAt'>;
export type BackupGroup = { id: string; state: GroupState; names: Record<string, string>; request?: GroupInfo['request'] };

export type Backup = {
	v: 1;
	/** segundos; vira o horário do ponto de partida dos grupos restaurados */
	createdAt: number;
	profile: { name: string; photo?: MessageMedia; updatedAt: number };
	contacts: BackupContact[];
	groups: BackupGroup[];
	settings: Record<string, unknown>;
};

/**
 * Monta o backup a partir do aparelho, sempre na mesma ordem: o mesmo conteúdo dá o mesmo texto, e assim dá para saber
 * se mudou. Pedidos de mensagem ficam de fora (voltam com as mensagens); bloqueados entram, para continuarem
 * bloqueados. Grupos de que saí não entram.
 */
export async function buildBackup(storage: Storage, me: string, now = Date.now()): Promise<Backup> {
	const identity = await storage.identity.get();
	const card = await storage.profiles.get(me);
	const contacts = (await storage.contacts.list())
		.filter((c) => c.state !== 'pedido' && c.publicKey !== me)
		.sort((a, b) => (a.publicKey < b.publicKey ? -1 : 1))
		.map(({ publicKey, localName, chosenName, state, dmRelays, addedAt }) => ({
			publicKey,
			...(localName ? { localName } : {}),
			...(chosenName ? { chosenName } : {}),
			state,
			dmRelays,
			addedAt
		}));
	const groups = (await storage.conversations.listByRecent())
		.filter((c) => c.group?.amMember && c.id.startsWith(GROUP_PREFIX))
		.map(({ id, group }) => ({
			id: id.slice(GROUP_PREFIX.length),
			state: group!.state,
			names: group!.names,
			...(group!.request ? { request: group!.request } : {})
		}))
		.sort((a, b) => (a.id < b.id ? -1 : 1));
	const settings: Record<string, unknown> = {};
	for (const key of BACKUP_SETTINGS) {
		const value = await storage.settings.get(key);
		if (value !== undefined) settings[key] = value;
	}
	return {
		v: 1,
		createdAt: Math.floor(now / 1000),
		profile: { name: identity?.displayName ?? card?.name ?? '', ...(card?.photo ? { photo: card.photo } : {}), updatedAt: card?.updatedAt ?? 0 },
		contacts,
		groups,
		settings
	};
}

/** O conteúdo que vai cifrado. */
export function backupContent(backup: Backup): string {
	const content = JSON.stringify(backup);
	if (new TextEncoder().encode(content).length > MAX_BACKUP_BYTES) throw new Error('backup grande demais');
	return content;
}

/** Lê um backup aberto pelo cofre; o que não tem o formato esperado é ignorado item a item. */
export function parseBackup(content: string): Backup | undefined {
	let raw: unknown;
	try {
		raw = JSON.parse(content);
	} catch {
		return undefined;
	}
	if (!isObject(raw) || raw.v !== 1 || !isObject(raw.profile)) return undefined;
	const profile = raw.profile;
	const settings: Record<string, unknown> = {};
	if (isObject(raw.settings)) for (const key of BACKUP_SETTINGS) if (key in raw.settings) settings[key] = raw.settings[key];
	return {
		v: 1,
		createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : 0,
		profile: {
			name: typeof profile.name === 'string' ? cleanName(profile.name) : '',
			...(isObject(profile.photo) ? { photo: profile.photo as MessageMedia } : {}),
			updatedAt: typeof profile.updatedAt === 'number' ? profile.updatedAt : 0
		},
		contacts: (Array.isArray(raw.contacts) ? raw.contacts : []).filter(isContact),
		groups: (Array.isArray(raw.groups) ? raw.groups : []).filter(isGroup),
		settings
	};
}

/**
 * Junta o backup ao que já está no aparelho, sem apagar nada daqui. Contato que a sincronização criou como pedido
 * (mensagem dos últimos 7 dias) volta ao estado que eu tinha dado. Grupo que ainda não existe aqui volta com o estado
 * do backup como ponto de partida, e os avisos que chegarem depois seguem dele. Ajustes só entram se faltam.
 * O perfil não é aplicado aqui: quem restaura decide (session.finishRestore).
 */
export async function applyBackup(storage: Storage, me: string, backup: Backup): Promise<void> {
	await exclusive(storage, async () => {
		for (const c of backup.contacts) {
			if (c.publicKey === me) continue;
			const existing = await storage.contacts.get(c.publicKey);
			if (!existing) {
				await storage.contacts.put({ ...c });
				continue;
			}
			await storage.contacts.put({
				...existing,
				state: existing.state === 'pedido' ? c.state : existing.state,
				localName: existing.localName ?? c.localName,
				chosenName: existing.chosenName ?? c.chosenName,
				dmRelays: existing.dmRelays.length ? existing.dmRelays : c.dmRelays,
				addedAt: Math.min(existing.addedAt, c.addedAt)
			});
		}
		for (const g of backup.groups) {
			const id = groupConversationId(g.id);
			if (!g.state.members.some((m) => m.publicKey === me) || (await storage.conversations.get(id))) continue;
			await storage.groupEvents.put({
				id: `backup:${g.id}`,
				groupId: g.id,
				author: me,
				createdAt: backup.createdAt,
				// o primeiro a chegar: é o ponto de partida do replay (groups.ts)
				receivedAt: 0,
				action: RESTORED_ACTION,
				targets: [],
				recipients: [],
				state: g.state
			});
			const conversation: ConversationRecord = {
				id,
				type: 'grupo',
				members: g.state.members.map((m) => m.publicKey).filter((k) => k !== me),
				group: {
					state: g.state,
					names: g.names,
					everMembers: g.state.members.map((m) => m.publicKey),
					amMember: true,
					...(g.request ? { request: g.request } : {})
				},
				lastMessageAt: backup.createdAt,
				unread: 0
			};
			await storage.conversations.put(conversation);
		}
		for (const [key, value] of Object.entries(backup.settings)) {
			if ((await storage.settings.get(key)) === undefined) await storage.settings.set(key, value);
		}
	});
}

/** Mudou algo desde o último publicado? (o horário do backup não conta) */
export function backupChanged(previous: string | undefined, next: Backup): boolean {
	if (!previous) return true;
	const old = parseBackup(previous);
	return !old || JSON.stringify({ ...old, createdAt: 0 }) !== JSON.stringify({ ...next, createdAt: 0 });
}

/**
 * Procura o meu backup. `answered` diz se algum relay respondeu: sem resposta, não dá para saber se existe, e quem
 * chama não pode publicar um backup novo por cima (apagaria o bom).
 */
export async function fetchBackup(pool: RelayPool, relays: string[], me: string): Promise<{ events: NostrEvent[]; answered: boolean }> {
	const { events, answered } = await pool.queryAnswered(relays, [{ kinds: [BACKUP_KIND], authors: [me], '#d': [BACKUP_D_TAG] }]);
	// o mais novo primeiro; quem abre (o cofre) confere a assinatura e descarta o que não é meu
	return { events: events.filter((e) => e.pubkey === me).sort((a, b) => b.created_at - a.created_at), answered: answered > 0 };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isKey = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string');

function isContact(v: unknown): v is BackupContact {
	return (
		isObject(v) &&
		isKey(v.publicKey) &&
		(v.state === 'aceito' || v.state === 'bloqueado') &&
		isStrings(v.dmRelays) &&
		typeof v.addedAt === 'number' &&
		(v.localName === undefined || typeof v.localName === 'string') &&
		(v.chosenName === undefined || typeof v.chosenName === 'string')
	);
}

function isGroup(v: unknown): v is BackupGroup {
	if (!isObject(v) || typeof v.id !== 'string' || !/^[0-9a-f]{32}$/.test(v.id) || !isObject(v.state) || !isObject(v.names)) return false;
	const state = v.state;
	return (
		typeof state.name === 'string' &&
		isKey(state.creator) &&
		Array.isArray(state.members) &&
		state.members.every((m) => isObject(m) && isKey(m.publicKey) && typeof m.joinedAt === 'number') &&
		Array.isArray(state.admins) &&
		state.admins.every(isKey)
	);
}
