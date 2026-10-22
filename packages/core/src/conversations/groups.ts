// Grupos (RF-30..33, docs/06 §3.3). Não há servidor que decida quem manda: cada aparelho
// guarda os avisos de grupo (kind 4440) e refaz o estado sozinho, aceitando só o que o
// autor tinha permissão de fazer. Todos chegam ao mesmo resultado pela mesma regra.
//
// Cada aviso leva só a mudança ("adicionou Dave"), não a lista inteira: dois
// administradores mexendo ao mesmo tempo têm as duas mudanças somadas, em vez de uma
// apagar a outra. A lista completa vai junto só para quem entra, que não tem de onde partir.

import type { Rumor } from '../identity/vault.ts';
import { cleanName } from '../contacts/invite.ts';
import type { Storage } from '../storage/repositories.ts';
import type { ConversationRecord, GroupEventRecord, GroupInfo, GroupMember, GroupNotice, GroupState, MessageRecord } from '../storage/records.ts';
import { contactName } from '../contacts/contacts.ts';
import { toHex } from '../media/crypto.ts';
import { kindOf, NAME_TAG, preview as previewOf, refreshConversation, sendTime } from './messaging.ts';

/** Kind próprio dos avisos de grupo (faixa 4440–4449 reservada ao Lero-lero, Q-P1). */
export const GROUP_CONTROL_KIND = 4440;
export const GROUP_TAG = 'g';
export const ACTION_TAG = 'acao';
const TARGET_TAG = 'alvo';
const MEMBER_TAG = 'membro';
export const MAX_GROUP_MEMBERS = 20;
const MAX_GROUP_NAME = 60;

export type GroupAction = 'criar' | 'adicionar' | 'remover' | 'sair' | 'renomear' | 'promover' | 'rebaixar' | 'apresentar';
const ACTIONS = new Set<string>(['criar', 'adicionar', 'remover', 'sair', 'renomear', 'promover', 'rebaixar', 'apresentar']);
/** ações sobre uma pessoa só */
const SINGLE_TARGET = new Set<string>(['remover', 'promover', 'rebaixar']);

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

const cleanGroupName = (name: string) => cleanName(name).slice(0, MAX_GROUP_NAME);

// ---------- formato do aviso ----------

function roleOf(state: GroupState, publicKey: string): Role {
	if (state.creator === publicKey) return 'criador';
	return state.admins.includes(publicKey) ? 'admin' : 'membro';
}

export type ControlContent = { targets?: string[]; subject?: string; state?: GroupState };

export function controlTags(groupId: string, action: GroupAction, content: ControlContent, myName?: string): string[][] {
	const tags = [
		[GROUP_TAG, groupId],
		[ACTION_TAG, action],
		['v', '1'],
		['alt', 'Aviso de grupo do Lero-lero']
	];
	for (const target of content.targets ?? []) tags.push([TARGET_TAG, target]);
	const subject = content.state?.name ?? content.subject;
	if (subject !== undefined) tags.push(['subject', subject]);
	for (const m of content.state?.members ?? []) tags.push([MEMBER_TAG, m.publicKey, String(m.joinedAt), roleOf(content.state!, m.publicKey)]);
	const name = myName && cleanName(myName);
	if (name) tags.push([NAME_TAG, name]);
	return tags;
}

/** Lê a lista completa (criar, adicionar); undefined se algo não confere (membro repetido, mais de 20, sem criador…). */
function parseState(rumor: Rumor): GroupState | undefined {
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
	if (!creator || members.length > MAX_GROUP_MEMBERS) return undefined;
	return { name: cleanGroupName(rumor.tags.find((t) => t[0] === 'subject')?.[1] ?? ''), members, admins, creator };
}

/** Confere o formato de um aviso recebido; o que não confere é descartado. */
export function parseControl(rumor: Rumor, receivedAt: number): GroupEventRecord | undefined {
	if (rumor.kind !== GROUP_CONTROL_KIND) return undefined;
	const groupId = groupIdOf(rumor);
	const action = rumor.tags.find((t) => t[0] === ACTION_TAG)?.[1];
	if (!groupId || !action || !ACTIONS.has(action)) return undefined;
	const targets = [...new Set(rumor.tags.filter((t) => t[0] === TARGET_TAG).map((t) => t[1]))];
	if (!targets.every(isPublicKey)) return undefined;
	if (SINGLE_TARGET.has(action) ? targets.length !== 1 : action === 'adicionar' ? targets.length === 0 : targets.length > 0) return undefined;

	let state: GroupState | undefined;
	if (action === 'criar' || action === 'adicionar') {
		state = parseState(rumor);
		if (!state) return undefined;
	}
	let subject: string | undefined;
	if (action === 'renomear') {
		subject = cleanGroupName(rumor.tags.find((t) => t[0] === 'subject')?.[1] ?? '');
		if (!subject) return undefined;
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
		targets,
		recipients: rumor.tags.filter((t) => t[0] === 'p' && isPublicKey(t[1])).map((t) => t[1]),
		...(state ? { state } : {}),
		...(subject ? { subject } : {}),
		...(name ? { name } : {})
	};
}

// ---------- permissões ----------

export type GroupOp = Pick<GroupEventRecord, 'action' | 'author' | 'createdAt' | 'targets' | 'subject'>;

function without(state: GroupState, publicKey: string): GroupState {
	return {
		...state,
		members: state.members.filter((m) => m.publicKey !== publicKey),
		admins: state.admins.filter((k) => k !== publicKey)
	};
}

/** Sair é livre; se quem sai é o criador, o título passa ao sucessor, calculado aqui e não escolhido por ele. */
function leave(state: GroupState, who: string): GroupState {
	const after = without(state, who);
	if (state.creator !== who) return after;
	const heir = successor(state, who);
	return { ...after, creator: heir ?? '', admins: heir && !after.admins.includes(heir) ? [...after.admins, heir] : after.admins };
}

/**
 * Aplica uma mudança, ou devolve undefined se o autor não podia fazê-la.
 * Regras do Pedro (2026-10-22): administradores adicionam, renomeiam, promovem e
 * removem membros comuns; só o criador remove ou rebaixa administradores; ninguém
 * remove o criador; quando ele sai, o título vai para o sucessor (`successor`).
 * Quem entra entra no horário do aviso: a antiguidade não pode ser escolhida.
 */
export function applyOp(state: GroupState, op: GroupOp): GroupState | undefined {
	const { author } = op;
	if (!isMember(state, author)) return undefined;
	const isAdmin = state.admins.includes(author);
	const isCreator = state.creator === author;
	const [target] = op.targets;
	switch (op.action) {
		case 'adicionar': {
			const fresh = op.targets.filter((k) => !isMember(state, k));
			if (!isAdmin || fresh.length === 0 || state.members.length + fresh.length > MAX_GROUP_MEMBERS) return undefined;
			return { ...state, members: [...state.members, ...fresh.map((publicKey) => ({ publicKey, joinedAt: op.createdAt }))] };
		}
		case 'remover':
			if (target === author) return leave(state, author);
			if (!isMember(state, target) || target === state.creator) return undefined;
			if (state.admins.includes(target) ? !isCreator : !isAdmin) return undefined;
			return without(state, target);
		case 'sair':
			return leave(state, author);
		case 'renomear':
			return isAdmin && op.subject ? { ...state, name: op.subject } : undefined;
		case 'promover':
			if (!isAdmin || !isMember(state, target) || state.admins.includes(target)) return undefined;
			return { ...state, admins: [...state.admins, target] };
		case 'rebaixar':
			if (!isCreator || !state.admins.includes(target) || target === state.creator) return undefined;
			return { ...state, admins: state.admins.filter((k) => k !== target) };
		default:
			return undefined;
	}
}

export type ManageAction = 'adicionar' | 'remover' | 'renomear' | 'promover' | 'rebaixar';

/** Se eu posso fazer a ação, pelas mesmas regras de quem recebe: a tela só oferece o que vai valer. */
export function canDo(state: GroupState, me: string, action: ManageAction, target?: string): boolean {
	if (action === 'adicionar') return isMember(state, me) && state.admins.includes(me) && state.members.length < MAX_GROUP_MEMBERS;
	if (action === 'remover' && target === me) return false; // sair é outra ação
	return applyOp(state, { action, author: me, createdAt: 0, targets: target ? [target] : [], subject: 'nome' }) !== undefined;
}

// ---------- estado a partir dos avisos ----------

export type ReplayResult = {
	state?: GroupState;
	everMembers: string[];
	names: Record<string, string>;
	/** avisos que valeram (viram aviso na conversa) */
	applied: string[];
};

/** Alguém perdeu o papel de administrador (removido, rebaixado ou saiu), com o aviso que fez isso. */
type Loss = { who: string; event: GroupEventRecord };

/**
 * Refaz o estado do grupo, em ordem de horário (empate: menor id), só com o que era permitido.
 *
 * Contra avisos com horário falso (T17): o aviso de quem perdeu o papel não vale se tem
 * horário de antes da perda mas **chegou** depois dela. Quem foi removido não consegue
 * mais "voltar no tempo" para mexer no grupo.
 */
export function replay(events: GroupEventRecord[], me: string): ReplayResult {
	const first = run(events, me, new Set());
	const rejected = new Set<string>();
	for (const e of events) {
		const lost = first.losses.some(
			(l) => l.who === e.author && l.event.id !== e.id && e.createdAt < l.event.createdAt && e.receivedAt > l.event.receivedAt
		);
		if (lost) rejected.add(e.id);
	}
	const { state, everMembers, names, applied } = rejected.size ? run(events, me, rejected) : first;
	return { state, everMembers, names, applied };
}

function run(events: GroupEventRecord[], me: string, rejected: Set<string>): ReplayResult & { losses: Loss[] } {
	const valid = events.filter((e) => !rejected.has(e.id));
	const ordered = [...valid].sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1));
	// ponto de partida: a criação ou, para quem entrou depois, o primeiro aviso que **chegou**
	// e me inclui; um ex-membro não impõe um estado falso com horário antigo a quem acabou de entrar
	const base = valid.filter((e) => startsGroup(e, me)).sort((a, b) => a.receivedAt - b.receivedAt)[0];
	if (!base?.state) return { everMembers: [], names: {}, applied: [], losses: [] };

	let state = base.state;
	const applied = [base.id];
	const ever = new Set(state.members.map((m) => m.publicKey));
	const losses: Loss[] = [];
	// avisos mais antigos que o ponto de partida só chegam por repasse: são mudanças que quem
	// me adicionou ainda não conhecia (feitas ao mesmo tempo), então entram logo depois dele
	const older = ordered.filter((e) => e.createdAt < base.createdAt);
	const newer = ordered.filter((e) => e.createdAt >= base.createdAt);
	for (const e of [...older, ...newer]) {
		if (e === base || e.action === 'criar' || e.action === 'apresentar') continue;
		// o nome que veio na lista de quem me adicionou é mais novo que qualquer renomear anterior
		if (e.createdAt < base.createdAt && e.action === 'renomear') continue;
		// fui readicionado: enquanto estava fora não recebi os avisos, então parto da lista que veio junto
		if (!isMember(state, me) && startsGroup(e, me)) {
			state = e.state!;
			applied.push(e.id);
		} else {
			const next = applyOp(state, e);
			if (!next) continue;
			for (const admin of state.admins) if (!next.admins.includes(admin)) losses.push({ who: admin, event: e });
			state = next;
			applied.push(e.id);
		}
		state.members.forEach((m) => ever.add(m.publicKey));
	}
	const names: Record<string, string> = {};
	for (const e of ordered) if (e.name && ever.has(e.author)) names[e.author] = e.name;
	return { state, everMembers: [...ever], names, applied, losses };
}

/** Aviso que serve de ponto de partida: a criação, ou um aviso de um administrador que me adiciona. */
function startsGroup(e: GroupEventRecord, me: string): boolean {
	const state = e.state;
	if (!state) return false;
	if (e.action === 'criar') return state.creator === e.author && state.members.every((m) => m.joinedAt === e.createdAt);
	const mine = state.members.find((m) => m.publicKey === me);
	return e.action === 'adicionar' && e.targets.includes(me) && mine?.joinedAt === e.createdAt && state.admins.includes(e.author);
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
	// a ordem de chegada conta (replay): nunca dois avisos no mesmo instante
	const known = await storage.groupEvents.listByGroup(parsed.groupId);
	const event: GroupEventRecord = {
		...parsed,
		receivedAt: Math.max(now, ...known.map((e) => e.receivedAt + 1)),
		...(rumor.pubkey === me ? { rumor } : {})
	};
	await storage.groupEvents.put(event);

	const all = [...known, event];
	const { state, everMembers, names, applied } = replay(all, me);
	if (!state) return undefined;
	const before = existing?.group;
	const amMember = isMember(state, me);
	// nomes que vieram nas mensagens (messaging.ts) continuam; os das apresentações valem por cima
	const group: GroupInfo = { state, names: { ...before?.names, ...names }, everMembers, amMember };
	const conversation: ConversationRecord = {
		unread: 0,
		lastMessageAt: event.createdAt,
		...existing,
		id,
		type: 'grupo',
		members: state.members.map((m) => m.publicKey).filter((k) => k !== me),
		group
	};
	await storage.conversations.put(conversation);
	if (!existing) await adoptHeldMessages(storage, conversation, me);
	await syncNotices(storage, conversation, all, new Set(applied), me);

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
 * Um aviso na conversa para cada aviso de grupo que valeu. Um aviso que deixou de valer
 * (ex.: chegou outro que o anula, T17) some da conversa.
 */
async function syncNotices(storage: Storage, conversation: ConversationRecord, events: GroupEventRecord[], applied: Set<string>, me: string) {
	const nameOf = await groupNames(storage, conversation.group!, me);
	let changed = false;
	for (const e of events) {
		if (e.action === 'apresentar') continue;
		const stored = await storage.messages.get(e.id);
		if (!applied.has(e.id)) {
			if (stored?.notice) {
				await storage.messages.delete(e.id);
				changed = true;
			}
			continue;
		}
		if (stored) continue;
		const notice: GroupNotice = { action: e.action, targets: e.targets, ...(e.subject ?? e.state?.name ? { subject: e.subject ?? e.state!.name } : {}) };
		await storage.messages.put({
			id: e.id,
			conversationId: conversation.id,
			sender: e.author,
			kind: GROUP_CONTROL_KIND,
			text: describeNotice(notice, e.author, nameOf),
			createdAt: e.createdAt,
			status: e.author === me ? 'enviada' : 'recebida',
			notice
		});
		changed = true;
	}
	if (changed) await refreshConversation(storage, conversation.id);
}

/**
 * Nome de cada membro para os avisos: "Você"; o nome do contato; o nome que a pessoa
 * mandou ao grupo, com "~" (não está nos contatos e pode ter escolhido qualquer nome).
 */
export async function groupNames(storage: Storage, group: GroupInfo, me: string): Promise<(publicKey: string) => string> {
	const names = new Map<string, string>();
	for (const key of group.everMembers) {
		const contact = await storage.contacts.get(key);
		if (contact?.state === 'aceito') names.set(key, contactName(contact));
		else if (group.names[key]) names.set(key, `~${group.names[key]}`);
	}
	return (key) => (key === me ? 'Você' : (names.get(key) ?? 'Alguém'));
}

/** "Ana, Bruno e Carla" */
function listNames(names: string[]): string {
	return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} e ${names.at(-1)}`;
}

/** Texto do aviso na conversa; `nameOf` dá "Você" para mim (no meio da frase vira "você"). */
export function describeNotice(notice: GroupNotice, author: string, nameOf: (publicKey: string) => string): string {
	const who = nameOf(author);
	const target = (k: string) => (nameOf(k) === 'Você' ? 'você' : nameOf(k));
	const targets = listNames(notice.targets.map(target));
	switch (notice.action) {
		case 'criar':
			return `${who} criou o grupo “${notice.subject ?? ''}”`;
		case 'adicionar':
			return `${who} adicionou ${targets}`;
		case 'remover':
			return notice.targets[0] === author ? `${who} saiu do grupo` : `${who} removeu ${targets}`;
		case 'sair':
			return `${who} saiu do grupo`;
		case 'renomear':
			return `${who} mudou o nome do grupo para “${notice.subject ?? ''}”`;
		case 'promover':
			return `${who} deu a ${targets} a função de administrador`;
		case 'rebaixar':
			return `${who} tirou ${targets} da função de administrador`;
		default:
			return `${who} mudou o grupo`;
	}
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
	const isLatest = latest.createdAt >= conversation.lastMessageAt;
	await storage.conversations.put({
		...conversation,
		unread: conversation.unread + unread,
		lastMessageAt: Math.max(conversation.lastMessageAt, latest.createdAt),
		lastMessagePreview: isLatest ? previewOf(latest) : conversation.lastMessagePreview,
		lastMessageKind: isLatest ? kindOf(latest) : conversation.lastMessageKind
	});
}

// ---------- repasse ----------

/** Só os avisos que mudam o grupo; a criação e as apresentações não precisam de repasse. */
const FORWARDABLE = new Set<string>(['adicionar', 'remover', 'sair', 'promover', 'rebaixar']);
/**
 * Só repasso o que fiz pouco antes de a pessoa entrar (mudanças ao mesmo tempo); o que é
 * mais antigo já estava na lista que ela recebeu ao entrar.
 */
export const FORWARD_WINDOW_S = 24 * 60 * 60;

/**
 * Avisos meus que algum membro atual não recebeu, porque eu ainda não sabia que ele
 * estava no grupo (ex.: removi Carol enquanto Alice adicionava Dave). Sem o repasse,
 * Dave continuaria vendo Carol no grupo e mandando mensagens a ela (RF-32). Já marca
 * como repassados: quem envia é a fila, que tenta até conseguir.
 */
export async function takeForwards(storage: Storage, conversation: ConversationRecord, me: string): Promise<{ rumor: Rumor; to: string[] }[]> {
	if (!conversation.group?.amMember) return [];
	const forwards: { rumor: Rumor; to: string[] }[] = [];
	for (const event of await storage.groupEvents.listByGroup(groupIdFrom(conversation))) {
		if (event.author !== me || !event.rumor || !FORWARDABLE.has(event.action)) continue;
		const joinedAt = (k: string) => conversation.group!.state.members.find((m) => m.publicKey === k)?.joinedAt ?? 0;
		const to = conversation.members.filter((k) => !event.recipients.includes(k) && event.createdAt >= joinedAt(k) - FORWARD_WINDOW_S);
		if (to.length === 0) continue;
		await storage.groupEvents.put({ ...event, recipients: [...event.recipients, ...to] });
		forwards.push({ rumor: event.rumor, to });
	}
	return forwards;
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

function stateOf(conversation: ConversationRecord): GroupState {
	if (!conversation.group) throw new Error('não é um grupo');
	return conversation.group.state;
}

const groupIdFrom = (conversation: ConversationRecord) => conversation.id.slice('grupo:'.length);

/** Confere a mudança com as mesmas regras de quem recebe e monta o aviso. */
function change(
	conversation: ConversationRecord,
	me: string,
	action: GroupAction,
	content: { targets?: string[]; subject?: string },
	myName: string,
	now: number
): GroupChange {
	const before = stateOf(conversation);
	// sem isso, "adicionar e já promover" no mesmo segundo poderia valer na ordem inversa
	const createdAt = sendTime(conversation, now);
	const after = applyOp(before, { action, author: me, createdAt, targets: content.targets ?? [], subject: content.subject });
	if (!after) throw new GroupPermissionError();
	const groupId = groupIdFrom(conversation);
	const recipients = new Set([...before.members, ...after.members].map((m) => m.publicKey));
	recipients.delete(me);
	// quem entra recebe a lista completa, para ter de onde partir
	const tags = controlTags(groupId, action, { ...content, ...(action === 'adicionar' ? { state: after } : {}) }, myName);
	return { groupId, action, createdAt, tags, recipients: [...recipients] };
}

/** Cria um grupo comigo como criador (RF-31). */
export function createGroup(me: string, name: string, members: string[], myName: string, now = Date.now()): GroupChange {
	const createdAt = seconds(now);
	const others = [...new Set(members)].filter((k) => k !== me);
	if (!others.every(isPublicKey)) throw new Error('membro inválido');
	if (others.length + 1 > MAX_GROUP_MEMBERS) throw new Error(`O grupo pode ter até ${MAX_GROUP_MEMBERS} pessoas`);
	const groupName = cleanGroupName(name);
	if (!groupName) throw new Error('Dê um nome ao grupo');
	const state: GroupState = {
		name: groupName,
		members: [me, ...others].map((publicKey) => ({ publicKey, joinedAt: createdAt })),
		admins: [me],
		creator: me
	};
	const groupId = newGroupId();
	return { groupId, action: 'criar', createdAt, tags: controlTags(groupId, 'criar', { state }, myName), recipients: others };
}

export function addMembers(conversation: ConversationRecord, me: string, publicKeys: string[], myName: string, now = Date.now()): GroupChange {
	const fresh = [...new Set(publicKeys)].filter((k) => isPublicKey(k) && !isMember(stateOf(conversation), k));
	if (stateOf(conversation).members.length + fresh.length > MAX_GROUP_MEMBERS) throw new Error(`O grupo pode ter até ${MAX_GROUP_MEMBERS} pessoas`);
	return change(conversation, me, 'adicionar', { targets: fresh }, myName, now);
}

export const removeMember = (conversation: ConversationRecord, me: string, publicKey: string, myName: string, now = Date.now()) =>
	change(conversation, me, 'remover', { targets: [publicKey] }, myName, now);

/** Sair do grupo; se eu era o criador, cada aparelho passa o título ao sucessor. */
export const leaveGroup = (conversation: ConversationRecord, me: string, myName: string, now = Date.now()) =>
	change(conversation, me, 'sair', {}, myName, now);

export function renameGroup(conversation: ConversationRecord, me: string, name: string, myName: string, now = Date.now()): GroupChange {
	const subject = cleanGroupName(name);
	if (!subject) throw new Error('Dê um nome ao grupo');
	return change(conversation, me, 'renomear', { subject }, myName, now);
}

export const promoteAdmin = (conversation: ConversationRecord, me: string, publicKey: string, myName: string, now = Date.now()) =>
	change(conversation, me, 'promover', { targets: [publicKey] }, myName, now);

export const demoteAdmin = (conversation: ConversationRecord, me: string, publicKey: string, myName: string, now = Date.now()) =>
	change(conversation, me, 'rebaixar', { targets: [publicKey] }, myName, now);

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
		tags: controlTags(groupId, 'apresentar', {}, myName),
		recipients: to ?? conversation.members
	};
}
