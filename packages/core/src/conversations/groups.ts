// Grupos (RF-30..33, docs/06 §3.3). Não há servidor que decida quem manda: cada aparelho
// guarda os avisos de grupo (kind 4440) e refaz o estado sozinho, aceitando só o que o
// autor tinha permissão de fazer. Todos chegam ao mesmo resultado pela mesma regra.

import type { Rumor } from '../identity/vault.ts';
import { cleanName } from '../contacts/invite.ts';
import type { Storage } from '../storage/repositories.ts';
import type { ConversationRecord, GroupEventRecord, MessageRecord, GroupInfo, GroupMember, GroupState } from '../storage/records.ts';
import { toHex } from '../media/crypto.ts';
import { kindOf, NAME_TAG, preview as previewOf } from './messaging.ts';

/** Kind próprio dos avisos de grupo (faixa 4440–4449 reservada ao Lero-lero, Q-P1). */
export const GROUP_CONTROL_KIND = 4440;
export const GROUP_TAG = 'g';
export const ACTION_TAG = 'acao';
const MEMBER_TAG = 'membro';
export const MAX_GROUP_MEMBERS = 20;
const MAX_GROUP_NAME = 60;

export type GroupAction = 'criar' | 'adicionar' | 'remover' | 'sair' | 'renomear' | 'promover' | 'rebaixar' | 'apresentar';
const ACTIONS = new Set<string>(['criar', 'adicionar', 'remover', 'sair', 'renomear', 'promover', 'rebaixar', 'apresentar']);

type Role = 'criador' | 'admin' | 'membro';

export class GroupPermissionError extends Error {
	constructor() {
		super('Você não tem permissão para fazer isso no grupo');
		this.name = 'GroupPermissionError';
	}
}

export const groupConversationId = (groupId: string) => `grupo:${groupId}`;

const isPublicKey = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);

/** Id do grupo na tag `g`: 16 bytes aleatórios em hex. */
export function groupIdOf(rumor: Pick<Rumor, 'tags'>): string | undefined {
	const id = rumor.tags.find((t) => t[0] === GROUP_TAG)?.[1];
	return id && /^[0-9a-f]{32}$/.test(id) ? id : undefined;
}

export const newGroupId = () => toHex(crypto.getRandomValues(new Uint8Array(16)));

export const isMember = (state: GroupState, publicKey: string) => state.members.some((m) => m.publicKey === publicKey);

/** Mais antigo primeiro; empate pela menor chave, para todos os aparelhos concordarem. */
const bySeniority = (a: GroupMember, b: GroupMember) => a.joinedAt - b.joinedAt || (a.publicKey < b.publicKey ? -1 : 1);

/** Quem herda o título quando o criador sai: o administrador mais antigo; sem outro, o membro mais antigo. */
export function successor(state: GroupState, leaving: string): string | undefined {
	const others = state.members.filter((m) => m.publicKey !== leaving).sort(bySeniority);
	return (others.find((m) => state.admins.includes(m.publicKey)) ?? others[0])?.publicKey;
}

// ---------- formato do aviso ----------

function roleOf(state: GroupState, publicKey: string): Role {
	if (state.creator === publicKey) return 'criador';
	return state.admins.includes(publicKey) ? 'admin' : 'membro';
}

/** Tags de um aviso de grupo: o estado completo vai em todos, para um aviso perdido não deixar o grupo errado. */
export function controlTags(groupId: string, action: GroupAction, state: GroupState | undefined, myName?: string): string[][] {
	const tags = [
		[GROUP_TAG, groupId],
		[ACTION_TAG, action],
		['v', '1'],
		['alt', 'Aviso de grupo do Lero-lero']
	];
	if (state) {
		tags.push(['subject', state.name]);
		for (const m of state.members) tags.push([MEMBER_TAG, m.publicKey, String(m.joinedAt), roleOf(state, m.publicKey)]);
	}
	const name = myName && cleanName(myName);
	if (name) tags.push([NAME_TAG, name]);
	return tags;
}

/** Lê o estado de um aviso; undefined se algo não confere (membro repetido, mais de 20, sem criador…). */
function parseState(rumor: Rumor, action: string): GroupState | undefined {
	const members: GroupMember[] = [];
	const admins: string[] = [];
	let creator = '';
	for (const t of rumor.tags.filter((t) => t[0] === MEMBER_TAG)) {
		const [, publicKey, joined, role] = t;
		const joinedAt = Number(joined);
		if (!isPublicKey(publicKey) || !Number.isSafeInteger(joinedAt) || members.some((m) => m.publicKey === publicKey)) return undefined;
		if (role !== 'criador' && role !== 'admin' && role !== 'membro') return undefined;
		members.push({ publicKey, joinedAt });
		if (role !== 'membro') admins.push(publicKey);
		if (role === 'criador') {
			if (creator) return undefined;
			creator = publicKey;
		}
	}
	if (members.length > MAX_GROUP_MEMBERS) return undefined;
	// o último membro saindo deixa o grupo vazio, sem criador
	if (!creator && !(action === 'sair' && members.length === 0)) return undefined;
	const name = cleanName(rumor.tags.find((t) => t[0] === 'subject')?.[1] ?? '').slice(0, MAX_GROUP_NAME);
	return { name, members, admins, creator };
}

/** Confere o formato de um aviso recebido; o que não confere é descartado. */
export function parseControl(rumor: Rumor, receivedAt: number): GroupEventRecord | undefined {
	if (rumor.kind !== GROUP_CONTROL_KIND) return undefined;
	const groupId = groupIdOf(rumor);
	const action = rumor.tags.find((t) => t[0] === ACTION_TAG)?.[1];
	if (!groupId || !action || !ACTIONS.has(action)) return undefined;
	let state: GroupState | undefined;
	if (action !== 'apresentar') {
		state = parseState(rumor, action);
		if (!state) return undefined;
	}
	const sentName = rumor.tags.find((t) => t[0] === NAME_TAG)?.[1];
	const name = sentName ? cleanName(sentName) || undefined : undefined;
	return {
		id: rumor.id,
		groupId,
		author: rumor.pubkey,
		createdAt: rumor.created_at,
		receivedAt,
		action,
		...(state ? { state } : {}),
		...(name ? { name } : {})
	};
}

// ---------- permissões ----------

const keys = (state: GroupState) => new Set(state.members.map((m) => m.publicKey));

/**
 * O autor podia levar o grupo de `before` para `after`? Olha a diferença entre os dois
 * estados, não o nome da ação: um aviso não ganha poder por se dizer outra coisa.
 * Regras do Pedro (2026-10-22): administradores adicionam, renomeiam, promovem e
 * removem membros comuns; só o criador remove ou rebaixa administradores; ninguém
 * remove o criador; quando ele sai, o título vai para o sucessor (`successor`).
 */
export function permitted(before: GroupState, author: string, after: GroupState, createdAt: number): boolean {
	if (!isMember(before, author)) return false;
	const isAdmin = before.admins.includes(author);
	const isCreator = before.creator === author;
	const beforeKeys = keys(before);
	const afterKeys = keys(after);

	for (const m of after.members) {
		const old = before.members.find((b) => b.publicKey === m.publicKey);
		// a antiguidade decide a sucessão: não pode ser mexida, e quem entra entra agora
		if (old ? old.joinedAt !== m.joinedAt : !isAdmin || m.joinedAt !== createdAt) return false;
	}
	if (after.name !== before.name && !isAdmin) return false;

	for (const removed of beforeKeys) {
		if (afterKeys.has(removed) || removed === author) continue; // sair é livre
		if (removed === before.creator) return false;
		if (before.admins.includes(removed) ? !isCreator : !isAdmin) return false;
	}

	const creatorLeft = isCreator && !afterKeys.has(author);
	if (after.creator !== before.creator) {
		if (!creatorLeft || after.creator !== (successor(before, author) ?? '')) return false;
	} else if (creatorLeft && after.members.length > 0) {
		return false;
	}

	for (const admin of after.admins) {
		if (!before.admins.includes(admin) && !isAdmin && admin !== after.creator) return false;
	}
	for (const admin of before.admins) {
		// tirar da função quem continua no grupo: só o criador, e nunca a si mesmo
		if (afterKeys.has(admin) && !after.admins.includes(admin) && (!isCreator || admin === author)) return false;
	}
	return true;
}

// ---------- estado a partir dos avisos ----------

export type ReplayResult = { state?: GroupState; everMembers: string[]; names: Record<string, string> };

/**
 * Refaz o estado do grupo. O ponto de partida é a criação (feita por quem se diz criador)
 * ou, para quem entrou depois, o primeiro aviso **que chegou** e me inclui: um ex-membro
 * não consegue impor um estado falso com um horário mais antigo a quem acabou de entrar.
 * Daí em diante, em ordem de horário (empate: menor id), só vale o que era permitido.
 */
export function replay(events: GroupEventRecord[], me: string): ReplayResult {
	const ordered = [...events].sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1));
	const base = [...events]
		.filter((e) => e.state && startsGroup(e, me))
		.sort((a, b) => a.receivedAt - b.receivedAt || a.createdAt - b.createdAt)[0];
	const ever = new Set<string>();
	if (!base?.state) return { everMembers: [], names: {} };

	let state: GroupState = base.state;
	state.members.forEach((m) => ever.add(m.publicKey));
	for (const e of ordered) {
		if (!e.state || e === base || e.createdAt < base.createdAt) continue;
		if (permitted(state, e.author, e.state, e.createdAt)) {
			state = e.state;
			state.members.forEach((m) => ever.add(m.publicKey));
		}
	}
	const names: Record<string, string> = {};
	for (const e of ordered) if (e.name && ever.has(e.author)) names[e.author] = e.name;
	return { state, everMembers: [...ever], names };
}

function startsGroup(e: GroupEventRecord, me: string): boolean {
	const state = e.state!;
	if (e.action === 'criar') return state.creator === e.author && state.members.every((m) => m.joinedAt === e.createdAt);
	return isMember(state, me) && state.admins.includes(e.author);
}

// ---------- guardar um aviso recebido ----------

export type StoredGroupChange = {
	conversation: ConversationRecord;
	isNew: boolean;
	/** acabei de entrar (ou voltar) no grupo: hora de me apresentar a todos */
	joined: boolean;
	/** membros que entraram agora: me apresento só a eles */
	newMembers: string[];
};

/**
 * Guarda um aviso de grupo (recebido, ou o que eu mesmo acabei de fazer) e atualiza a
 * conversa. Devolve undefined se o aviso não vale ou o grupo ainda não me inclui.
 */
export async function storeGroupControl(
	storage: Storage,
	me: string,
	rumor: Rumor,
	now = Date.now()
): Promise<StoredGroupChange | undefined> {
	const parsed = parseControl(rumor, now);
	if (!parsed) return undefined;
	const id = groupConversationId(parsed.groupId);
	const existing = await storage.conversations.get(id);
	if (await storage.groupEvents.get(parsed.id)) {
		return existing && { conversation: existing, isNew: false, joined: false, newMembers: [] };
	}
	// a ordem de chegada decide o ponto de partida (replay): nunca dois avisos no mesmo instante
	const known = await storage.groupEvents.listByGroup(parsed.groupId);
	const event = { ...parsed, receivedAt: Math.max(now, ...known.map((e) => e.receivedAt + 1)) };
	await storage.groupEvents.put(event);

	const { state, everMembers, names } = replay([...known, event], me);
	if (!state) return undefined;
	const before = existing?.group;
	const amMember = isMember(state, me);
	const group: GroupInfo = { state, names, everMembers, amMember };
	const conversation: ConversationRecord = {
		unread: 0,
		lastMessageAt: event.createdAt,
		lastMessagePreview: event.author === me ? 'Você criou o grupo' : 'Você foi adicionado ao grupo',
		lastMessageKind: 'texto',
		...existing,
		id,
		type: 'grupo',
		members: state.members.map((m) => m.publicKey).filter((k) => k !== me),
		group
	};
	await storage.conversations.put(conversation);
	if (!existing) await adoptHeldMessages(storage, conversation, me);

	const wasMember = before?.amMember ?? false;
	const previous = new Set(before?.state.members.map((m) => m.publicKey) ?? []);
	return {
		conversation: (await storage.conversations.get(id))!,
		isNew: true,
		joined: amMember && !wasMember,
		newMembers: wasMember ? conversation.members.filter((k) => !previous.has(k)) : []
	};
}

/**
 * Mensagens que chegaram antes do aviso que me pôs no grupo (os embrulhos chegam em
 * qualquer ordem): ficam guardadas sem conversa e entram agora, se forem de membros.
 */
async function adoptHeldMessages(storage: Storage, conversation: ConversationRecord, me: string) {
	const ever = new Set(conversation.group!.everMembers);
	const held = await storage.messages.listByConversation(conversation.id, 10_000);
	let unread = 0;
	let latest: MessageRecord | undefined;
	for (const message of held) {
		if (message.sender !== me && !ever.has(message.sender)) {
			await storage.messages.delete(message.id);
			continue;
		}
		if (message.sender !== me) unread++;
		latest = message;
	}
	if (!latest) return;
	await storage.conversations.put({
		...conversation,
		unread: conversation.unread + unread,
		lastMessageAt: Math.max(conversation.lastMessageAt, latest.createdAt),
		lastMessagePreview: latest.createdAt >= conversation.lastMessageAt ? previewOf(latest) : conversation.lastMessagePreview,
		lastMessageKind: latest.createdAt >= conversation.lastMessageAt ? kindOf(latest) : conversation.lastMessageKind
	});
}

// ---------- mudanças feitas por mim ----------

export type GroupChange = {
	groupId: string;
	action: GroupAction;
	/** vai como `created_at` do rumor: é o horário de entrada de quem foi adicionado */
	createdAt: number;
	tags: string[][];
	/** quem recebe o aviso: os membros de antes e de depois (quem saiu fica sabendo) */
	recipients: string[];
};

const seconds = (now: number) => Math.floor(now / 1000);

function change(
	groupId: string,
	action: GroupAction,
	me: string,
	before: GroupState | undefined,
	after: GroupState,
	createdAt: number,
	myName: string
): GroupChange {
	if (before && !permitted(before, me, after, createdAt)) throw new GroupPermissionError();
	const recipients = new Set([...(before?.members ?? []), ...after.members].map((m) => m.publicKey));
	recipients.delete(me);
	return { groupId, action, createdAt, tags: controlTags(groupId, action, after, myName), recipients: [...recipients] };
}

function stateOf(conversation: ConversationRecord): GroupState {
	if (!conversation.group) throw new Error('não é um grupo');
	return conversation.group.state;
}

/** Cria um grupo comigo como criador (RF-31). */
export function createGroup(me: string, name: string, members: string[], myName: string, now = Date.now()): GroupChange {
	const createdAt = seconds(now);
	const others = [...new Set(members)].filter((k) => k !== me);
	if (!others.every(isPublicKey)) throw new Error('membro inválido');
	if (others.length + 1 > MAX_GROUP_MEMBERS) throw new Error(`O grupo pode ter até ${MAX_GROUP_MEMBERS} pessoas`);
	const groupName = cleanName(name).slice(0, MAX_GROUP_NAME);
	if (!groupName) throw new Error('Dê um nome ao grupo');
	const state: GroupState = {
		name: groupName,
		members: [me, ...others].map((publicKey) => ({ publicKey, joinedAt: createdAt })),
		admins: [me],
		creator: me
	};
	return change(newGroupId(), 'criar', me, undefined, state, createdAt, myName);
}

const groupIdFrom = (conversation: ConversationRecord) => conversation.id.slice('grupo:'.length);

export function addMembers(conversation: ConversationRecord, me: string, publicKeys: string[], myName: string, now = Date.now()): GroupChange {
	const before = stateOf(conversation);
	const createdAt = seconds(now);
	const fresh = [...new Set(publicKeys)].filter((k) => isPublicKey(k) && !isMember(before, k));
	if (before.members.length + fresh.length > MAX_GROUP_MEMBERS) throw new Error(`O grupo pode ter até ${MAX_GROUP_MEMBERS} pessoas`);
	const after = { ...before, members: [...before.members, ...fresh.map((publicKey) => ({ publicKey, joinedAt: createdAt }))] };
	return change(groupIdFrom(conversation), 'adicionar', me, before, after, createdAt, myName);
}

export function removeMember(conversation: ConversationRecord, me: string, publicKey: string, myName: string, now = Date.now()): GroupChange {
	const before = stateOf(conversation);
	const after = without(before, publicKey);
	return change(groupIdFrom(conversation), 'remover', me, before, after, seconds(now), myName);
}

/** Sair do grupo; se eu era o criador, o título passa ao sucessor. */
export function leaveGroup(conversation: ConversationRecord, me: string, myName: string, now = Date.now()): GroupChange {
	const before = stateOf(conversation);
	let after = without(before, me);
	if (before.creator === me) {
		const heir = successor(before, me);
		after = { ...after, creator: heir ?? '', admins: heir && !after.admins.includes(heir) ? [...after.admins, heir] : after.admins };
	}
	return change(groupIdFrom(conversation), 'sair', me, before, after, seconds(now), myName);
}

export function renameGroup(conversation: ConversationRecord, me: string, name: string, myName: string, now = Date.now()): GroupChange {
	const before = stateOf(conversation);
	const groupName = cleanName(name).slice(0, MAX_GROUP_NAME);
	if (!groupName) throw new Error('Dê um nome ao grupo');
	return change(groupIdFrom(conversation), 'renomear', me, before, { ...before, name: groupName }, seconds(now), myName);
}

export function promoteAdmin(conversation: ConversationRecord, me: string, publicKey: string, myName: string, now = Date.now()): GroupChange {
	const before = stateOf(conversation);
	if (!isMember(before, publicKey) || before.admins.includes(publicKey)) throw new Error('Não é um membro comum');
	return change(groupIdFrom(conversation), 'promover', me, before, { ...before, admins: [...before.admins, publicKey] }, seconds(now), myName);
}

export function demoteAdmin(conversation: ConversationRecord, me: string, publicKey: string, myName: string, now = Date.now()): GroupChange {
	const before = stateOf(conversation);
	const after = { ...before, admins: before.admins.filter((k) => k !== publicKey) };
	return change(groupIdFrom(conversation), 'rebaixar', me, before, after, seconds(now), myName);
}

/**
 * Meu nome para o grupo (ação `apresentar`): a todos quando entro, ou só a quem acabou
 * de entrar. O nome é privado, então só vai cifrado para quem está no grupo.
 */
export function introduce(conversation: ConversationRecord, myName: string, to?: string[], now = Date.now()): GroupChange {
	const groupId = groupIdFrom(conversation);
	return {
		groupId,
		action: 'apresentar',
		createdAt: seconds(now),
		tags: controlTags(groupId, 'apresentar', undefined, myName),
		recipients: to ?? conversation.members
	};
}

function without(state: GroupState, publicKey: string): GroupState {
	return {
		...state,
		members: state.members.filter((m) => m.publicKey !== publicKey),
		admins: state.admins.filter((k) => k !== publicKey)
	};
}
