import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { KdfParams } from '../crypto/seal.ts';
import { createVault } from '../identity/vault.ts';
import { openStorage } from '../storage/repositories.ts';
import type { GroupState } from '../storage/records.ts';
import {
	addMembers,
	canDo,
	controlTags,
	createGroup,
	demoteAdmin,
	GROUP_CONTROL_KIND,
	groupConversationId,
	groupNames,
	GroupPermissionError,
	introduce,
	leaveGroup,
	promoteAdmin,
	removeMember,
	renameGroup,
	storeGroupControl,
	successor,
	takeForwards,
	type ControlContent,
	type GroupAction,
	type GroupChange
} from './groups.ts';
import { storeIncoming, storeOutgoing } from './messaging.ts';

const FAST: KdfParams = { memoryKiB: 64, iterations: 1, parallelism: 1 };
const closers: Array<() => void> = [];
afterEach(() => closers.splice(0).forEach((c) => c()));

let n = 0;
async function person(name: string) {
	const vault = createVault({ kdf: FAST });
	const { publicKey } = await vault.create('123456');
	const storage = openStorage(`grupos-${n++}`);
	closers.push(() => storage.close());
	return { name, vault, publicKey, storage };
}
type Person = Awaited<ReturnType<typeof person>>;

/** horário em ms; cada passo do teste avança 1 minuto */
let clock = 1_800_000_000_000;
const tick = () => (clock += 60_000);

/** Embrulha o aviso como o app faz, guarda na cópia de quem fez e devolve o que cada um recebe. */
function wrap(from: Person, change: GroupChange) {
	return from.vault.wrapGroupMessage(change.recipients, '', change.tags, GROUP_CONTROL_KIND, change.createdAt);
}

async function act(from: Person, change: GroupChange, to: Person[]) {
	const wrapped = wrap(from, change);
	await storeGroupControl(from.storage, from.publicKey, wrapped.rumor, clock);
	const results = new Map<string, Awaited<ReturnType<typeof storeGroupControl>>>();
	for (const p of to) {
		const item = wrapped.toRecipients.find((r) => r.recipient === p.publicKey);
		if (!item) throw new Error(`${p.name} não recebeu o aviso`);
		results.set(p.name, await storeGroupControl(p.storage, p.publicKey, p.vault.unwrap(item.wrap), clock));
	}
	return { wrapped, results };
}

const conversationOf = async (p: Person, groupId: string) => (await p.storage.conversations.get(groupConversationId(groupId)))!;
const stateOf = async (p: Person, groupId: string) => (await conversationOf(p, groupId)).group!.state;

async function family() {
	const alice = await person('Alice');
	const bob = await person('Bob');
	const carol = await person('Carol');
	const created = createGroup(alice.publicKey, 'Família', [bob.publicKey, carol.publicKey], 'Alice', tick());
	const { results } = await act(alice, created, [bob, carol]);
	return { alice, bob, carol, groupId: created.groupId, results };
}

/** Mensagem de grupo de `from` para todos os outros membros, como o app manda. */
async function say(from: Person, groupId: string, text: string, to: Person[]) {
	const conversation = await conversationOf(from, groupId);
	const wrapped = from.vault.wrapGroupMessage(conversation.members, text, [['g', groupId]], 14, Math.floor(tick() / 1000));
	await storeOutgoing(from.storage, wrapped.rumor);
	const got = new Map<string, Awaited<ReturnType<typeof storeIncoming>>>();
	for (const p of to) {
		const item = wrapped.toRecipients.find((r) => r.recipient === p.publicKey)!;
		got.set(p.name, await storeIncoming(p.storage, p.publicKey, p.vault.unwrap(item.wrap)));
	}
	return { wrapped, got };
}

/** Aviso forjado: alguém monta as tags à mão, sem passar pelas conferências do app. */
function forge(
	from: Person,
	groupId: string,
	action: GroupAction,
	content: ControlContent,
	to: string[],
	createdAt = Math.floor(tick() / 1000)
) {
	return from.vault.wrapGroupMessage(to, '', controlTags(groupId, action, content), GROUP_CONTROL_KIND, createdAt);
}

const deliver = (p: Person, w: ReturnType<typeof forge>) =>
	storeGroupControl(p.storage, p.publicKey, p.vault.unwrap(w.toRecipients.find((r) => r.recipient === p.publicKey)!.wrap), clock);

describe('criar grupo e conversar', () => {
	it('quem foi adicionado ganha a conversa de grupo, com os membros e o criador', async () => {
		const { alice, bob, carol, groupId, results } = await family();
		expect(results.get('Bob')).toMatchObject({ isNew: true, joined: true });
		const bobs = await conversationOf(bob, groupId);
		// a prévia guarda o aviso, não a frase: a tela monta "~Alice criou o grupo" na língua da pessoa (ADR-0008)
		expect(bobs).toMatchObject({
			type: 'grupo',
			lastMessageKind: 'aviso',
			lastNotice: { author: alice.publicKey, notice: { action: 'criar', subject: 'Família' } },
			unread: 0
		});
		expect(bobs.members.sort()).toEqual([alice.publicKey, carol.publicKey].sort());
		expect(bobs.group).toMatchObject({ amMember: true, state: { name: 'Família', creator: alice.publicKey, admins: [alice.publicKey] } });
		// o nome de quem criou chega junto, cifrado só para o grupo
		expect(bobs.group!.names[alice.publicKey]).toBe('Alice');
		expect((await conversationOf(alice, groupId)).lastNotice).toMatchObject({ author: alice.publicKey, notice: { action: 'criar' } });
	});

	it('a mensagem chega a todos na conversa do grupo, não na conversa 1:1', async () => {
		const { alice, bob, carol, groupId } = await family();
		const { got } = await say(alice, groupId, 'oi, gente', [bob, carol]);
		for (const name of ['Bob', 'Carol']) {
			expect(got.get(name)?.message).toMatchObject({ text: 'oi, gente', conversationId: groupConversationId(groupId) });
			expect(got.get(name)?.conversation).toMatchObject({ unread: 1, lastMessagePreview: 'oi, gente' });
		}
		// quem não é contato não vira "pedido de mensagem" só por estar no grupo
		expect(await bob.storage.contacts.get(alice.publicKey)).toBeUndefined();
	});

	it('quem não é membro não consegue pôr mensagem no grupo, mesmo sabendo o id', async () => {
		const { bob, groupId } = await family();
		const dave = await person('Dave');
		const wrapped = dave.vault.wrapGroupMessage([bob.publicKey], 'spam', [['g', groupId]]);
		const item = wrapped.toRecipients[0];
		expect(await storeIncoming(bob.storage, bob.publicKey, bob.vault.unwrap(item.wrap))).toBeUndefined();
		expect(await bob.storage.messages.get(wrapped.rumor.id)).toBeUndefined();
	});

	it('mensagem que chega antes do aviso de criação fica guardada e aparece depois; a de estranhos some', async () => {
		const alice = await person('Alice');
		const bob = await person('Bob');
		const dave = await person('Dave');
		const created = createGroup(alice.publicKey, 'Família', [bob.publicKey], 'Alice', tick());
		const wrappedCreation = wrap(alice, created);
		await storeGroupControl(alice.storage, alice.publicKey, wrappedCreation.rumor, clock);
		const early = await say(alice, created.groupId, 'chegou primeiro', []);
		const spam = dave.vault.wrapGroupMessage([bob.publicKey], 'spam', [['g', created.groupId]]);

		const toBob = (w: { toRecipients: { recipient: string; wrap: Parameters<typeof bob.vault.unwrap>[0] }[] }) =>
			bob.vault.unwrap(w.toRecipients.find((r) => r.recipient === bob.publicKey)!.wrap);
		expect(await storeIncoming(bob.storage, bob.publicKey, toBob(early.wrapped))).toBeUndefined();
		expect(await storeIncoming(bob.storage, bob.publicKey, toBob(spam))).toBeUndefined();
		await storeGroupControl(bob.storage, bob.publicKey, toBob(wrappedCreation), clock);

		const conversation = await conversationOf(bob, created.groupId);
		expect(conversation).toMatchObject({ unread: 1, lastMessagePreview: 'chegou primeiro' });
		const messages = await bob.storage.messages.listByConversation(conversation.id, 10);
		expect(messages.map((m) => m.notice?.action ?? m.text)).toEqual(['criar', 'chegou primeiro']);
	});
});

describe('permissões (docs/06 §3.3)', () => {
	it('membro comum não adiciona, não renomeia e não remove ninguém', async () => {
		const { bob, carol, groupId } = await family();
		const dave = await person('Dave');
		const bobs = await conversationOf(bob, groupId);
		expect(() => addMembers(bobs, bob.publicKey, [dave.publicKey], 'Bob', tick())).toThrow(GroupPermissionError);
		expect(() => renameGroup(bobs, bob.publicKey, 'Meu grupo', 'Bob', tick())).toThrow(GroupPermissionError);
		expect(() => removeMember(bobs, bob.publicKey, carol.publicKey, 'Bob', tick())).toThrow(GroupPermissionError);
	});

	it('um aviso forjado por membro comum é ignorado pelos outros', async () => {
		const { alice, bob, carol, groupId } = await family();
		const dave = await person('Dave');
		const at = Math.floor(tick() / 1000);
		const state = await stateOf(carol, groupId);
		const withDave = { ...state, members: [...state.members, { publicKey: dave.publicKey, joinedAt: at }] };
		await deliver(carol, forge(bob, groupId, 'adicionar', { targets: [dave.publicKey], state: withDave }, [carol.publicKey], at));
		await deliver(carol, forge(bob, groupId, 'renomear', { subject: 'Grupo do Bob' }, [carol.publicKey]));
		expect(await stateOf(carol, groupId)).toEqual(state);
		expect((await stateOf(carol, groupId)).creator).toBe(alice.publicKey);
	});

	it('administrador adiciona e remove membro comum; quem entra é apresentado aos outros', async () => {
		const { alice, bob, carol, groupId } = await family();
		const dave = await person('Dave');
		await act(alice, promoteAdmin(await conversationOf(alice, groupId), alice.publicKey, bob.publicKey, 'Alice', tick()), [bob, carol]);

		const added = addMembers(await conversationOf(bob, groupId), bob.publicKey, [dave.publicKey], 'Bob', tick());
		const { results } = await act(bob, added, [alice, carol, dave]);
		expect(results.get('Dave')).toMatchObject({ joined: true });
		expect(results.get('Carol')).toMatchObject({ joined: false, newMembers: [dave.publicKey] });
		expect((await stateOf(carol, groupId)).members.map((m) => m.publicKey)).toContain(dave.publicKey);

		const removed = removeMember(await conversationOf(bob, groupId), bob.publicKey, carol.publicKey, 'Bob', tick());
		expect(removed.recipients).toContain(carol.publicKey); // quem sai fica sabendo
		await act(bob, removed, [alice, carol, dave]);
		expect((await conversationOf(carol, groupId)).group!.amMember).toBe(false);
		expect((await conversationOf(dave, groupId)).members).not.toContain(carol.publicKey);
	});

	it('administrador não remove nem rebaixa outro administrador, nem o criador', async () => {
		const { alice, bob, carol, groupId } = await family();
		const promote = async (who: Person) => promoteAdmin(await conversationOf(alice, groupId), alice.publicKey, who.publicKey, 'Alice', tick());
		await act(alice, await promote(bob), [bob, carol]);
		await act(alice, await promote(carol), [bob, carol]);

		const bobs = await conversationOf(bob, groupId);
		expect(() => removeMember(bobs, bob.publicKey, carol.publicKey, 'Bob', tick())).toThrow(GroupPermissionError);
		expect(() => demoteAdmin(bobs, bob.publicKey, carol.publicKey, 'Bob', tick())).toThrow(GroupPermissionError);
		expect(() => removeMember(bobs, bob.publicKey, alice.publicKey, 'Bob', tick())).toThrow(GroupPermissionError);

		// forjado: Bob tira Alice e rebaixa Carol; Carol ignora
		const state = await stateOf(carol, groupId);
		await deliver(carol, forge(bob, groupId, 'remover', { targets: [alice.publicKey] }, [carol.publicKey]));
		await deliver(carol, forge(bob, groupId, 'rebaixar', { targets: [carol.publicKey] }, [carol.publicKey]));
		expect(await stateOf(carol, groupId)).toEqual(state);
	});

	it('só o criador remove ou rebaixa administradores', async () => {
		const { alice, bob, carol, groupId } = await family();
		await act(alice, promoteAdmin(await conversationOf(alice, groupId), alice.publicKey, bob.publicKey, 'Alice', tick()), [bob, carol]);
		await act(alice, demoteAdmin(await conversationOf(alice, groupId), alice.publicKey, bob.publicKey, 'Alice', tick()), [bob, carol]);
		expect((await stateOf(bob, groupId)).admins).toEqual([alice.publicKey]);
		// o criador não deixa de ser administrador
		const alices = await conversationOf(alice, groupId);
		expect(() => demoteAdmin(alices, alice.publicKey, alice.publicKey, 'Alice', tick())).toThrow(GroupPermissionError);
	});

	it('duas mudanças minhas no mesmo segundo valem na ordem em que fiz (adicionar e depois promover)', async () => {
		const { alice, bob, carol, groupId } = await family();
		const dave = await person('Dave');
		const now = tick();
		const added = addMembers(await conversationOf(alice, groupId), alice.publicKey, [dave.publicKey], 'Alice', now);
		await act(alice, added, [bob, carol, dave]);
		const promoted = promoteAdmin(await conversationOf(alice, groupId), alice.publicKey, dave.publicKey, 'Alice', now);
		expect(promoted.createdAt).toBeGreaterThan(added.createdAt);
		await act(alice, promoted, [bob, carol, dave]);
		expect((await stateOf(bob, groupId)).admins).toContain(dave.publicKey);
		const notices = (await bob.storage.messages.listByConversation(groupConversationId(groupId), 10)).map((m) => m.notice?.action);
		expect(notices.slice(-2)).toEqual(['adicionar', 'promover']);
	});

	it('canDo diz à tela o que cada um pode fazer, com as mesmas regras', async () => {
		const { alice, bob, carol, groupId } = await family();
		await act(alice, promoteAdmin(await conversationOf(alice, groupId), alice.publicKey, bob.publicKey, 'Alice', tick()), [bob, carol]);
		const state = await stateOf(carol, groupId);
		const [a, b, c] = [alice.publicKey, bob.publicKey, carol.publicKey];
		// criador: tudo, menos tirar a si mesmo
		expect(['adicionar', 'renomear'].every((x) => canDo(state, a, x as 'adicionar'))).toBe(true);
		expect([canDo(state, a, 'remover', b), canDo(state, a, 'rebaixar', b), canDo(state, a, 'remover', c)]).toEqual([true, true, true]);
		expect([canDo(state, a, 'remover', a), canDo(state, a, 'rebaixar', a), canDo(state, a, 'promover', b)]).toEqual([false, false, false]);
		// administrador: adiciona, renomeia, promove e remove membro comum; não mexe no criador
		expect([canDo(state, b, 'adicionar'), canDo(state, b, 'renomear'), canDo(state, b, 'promover', c), canDo(state, b, 'remover', c)]).toEqual([true, true, true, true]);
		expect([canDo(state, b, 'remover', a), canDo(state, b, 'rebaixar', a)]).toEqual([false, false]);
		// membro comum: nada
		expect([canDo(state, c, 'adicionar'), canDo(state, c, 'renomear'), canDo(state, c, 'promover', b), canDo(state, c, 'remover', b)]).toEqual([false, false, false, false]);
	});

	it('ninguém mexe na antiguidade: o horário de entrada é o do aviso', async () => {
		const { alice, bob, groupId } = await family();
		const dave = await person('Dave');
		const at = Math.floor(tick() / 1000);
		// a lista que vai junto diz que Dave entrou antes de todo mundo, para herdar o grupo
		const state = await stateOf(bob, groupId);
		const lie = { ...state, members: [...state.members, { publicKey: dave.publicKey, joinedAt: 1 }] };
		await deliver(bob, forge(alice, groupId, 'adicionar', { targets: [dave.publicKey], state: lie }, [bob.publicKey, dave.publicKey], at));
		expect((await stateOf(bob, groupId)).members.find((m) => m.publicKey === dave.publicKey)?.joinedAt).toBe(at);
	});
});

describe('quando o criador sai', () => {
	it('o título vai para o administrador mais antigo', async () => {
		const { alice, bob, carol, groupId } = await family();
		const dave = await person('Dave');
		await act(alice, addMembers(await conversationOf(alice, groupId), alice.publicKey, [dave.publicKey], 'Alice', tick()), [bob, carol, dave]);
		// Dave é administrador, mas entrou depois; Carol entrou antes e também é
		await act(alice, promoteAdmin(await conversationOf(alice, groupId), alice.publicKey, dave.publicKey, 'Alice', tick()), [bob, carol, dave]);
		await act(alice, promoteAdmin(await conversationOf(alice, groupId), alice.publicKey, carol.publicKey, 'Alice', tick()), [bob, carol, dave]);

		const { results } = await act(alice, leaveGroup(await conversationOf(alice, groupId), alice.publicKey, 'Alice', tick()), [bob, carol, dave]);
		expect(results.get('Bob')?.conversation.group!.state.creator).toBe(carol.publicKey);
		expect(await stateOf(dave, groupId)).toMatchObject({ creator: carol.publicKey });
		expect((await conversationOf(alice, groupId)).group!.amMember).toBe(false);
	});

	it('sem outro administrador, o membro mais antigo vira criador; empate pela menor chave', async () => {
		const { alice, bob, carol, groupId } = await family();
		await act(alice, leaveGroup(await conversationOf(alice, groupId), alice.publicKey, 'Alice', tick()), [bob, carol]);
		const heir = [bob.publicKey, carol.publicKey].sort()[0];
		expect(await stateOf(bob, groupId)).toMatchObject({ creator: heir, admins: [heir] });
		expect(await stateOf(carol, groupId)).toMatchObject({ creator: heir });
	});

	it('o criador não escolhe o herdeiro: cada aparelho calcula', async () => {
		const { alice, bob, carol, groupId } = await family();
		const state = await stateOf(bob, groupId);
		const heir = successor(state, alice.publicKey)!;
		const wrong = [bob.publicKey, carol.publicKey].find((k) => k !== heir)!;
		// um "sair" com uma lista que põe outra pessoa como criadora: a lista não conta
		const lie = { ...state, members: state.members.filter((m) => m.publicKey !== alice.publicKey), admins: [wrong], creator: wrong };
		await deliver(bob, forge(alice, groupId, 'sair', { state: lie }, [bob.publicKey]));
		expect((await stateOf(bob, groupId)).creator).toBe(heir);
	});
});

describe('ordem de chegada', () => {
	it('avisos fora de ordem dão o mesmo estado', async () => {
		const { alice, bob, carol, groupId } = await family();
		const dave = await person('Dave');
		const added = wrap(alice, addMembers(await conversationOf(alice, groupId), alice.publicKey, [dave.publicKey], 'Alice', tick()));
		await storeGroupControl(alice.storage, alice.publicKey, added.rumor, clock);
		const renamed = wrap(alice, renameGroup(await conversationOf(alice, groupId), alice.publicKey, 'Família Silva', 'Alice', tick()));
		const forBob = (w: typeof added) => bob.vault.unwrap(w.toRecipients.find((r) => r.recipient === bob.publicKey)!.wrap);
		const forCarol = (w: typeof added) => carol.vault.unwrap(w.toRecipients.find((r) => r.recipient === carol.publicKey)!.wrap);

		await storeGroupControl(bob.storage, bob.publicKey, forBob(added), clock);
		await storeGroupControl(bob.storage, bob.publicKey, forBob(renamed), clock);
		await storeGroupControl(carol.storage, carol.publicKey, forCarol(renamed), clock);
		await storeGroupControl(carol.storage, carol.publicKey, forCarol(added), clock);
		expect(await stateOf(carol, groupId)).toEqual(await stateOf(bob, groupId));
		expect(await stateOf(carol, groupId)).toMatchObject({ name: 'Família Silva' });
	});

	it('um ex-membro não engana quem entrou depois com um aviso de horário antigo', async () => {
		const { alice, bob, carol, groupId } = await family();
		const dave = await person('Dave');
		// Alice promove Bob e depois o remove; Bob guarda o id do grupo
		await act(alice, promoteAdmin(await conversationOf(alice, groupId), alice.publicKey, bob.publicKey, 'Alice', tick()), [bob, carol]);
		const before = await stateOf(bob, groupId);
		await act(alice, removeMember(await conversationOf(alice, groupId), alice.publicKey, bob.publicKey, 'Alice', tick()), [bob, carol]);
		await act(alice, addMembers(await conversationOf(alice, groupId), alice.publicKey, [dave.publicKey], 'Alice', tick()), [carol, dave]);

		// Bob manda a Dave um estado "de quando era administrador", com Dave dentro e Alice fora
		const at = before.members[0].joinedAt + 1;
		const fake: GroupState = {
			...before,
			members: [...before.members.filter((m) => m.publicKey !== alice.publicKey), { publicKey: dave.publicKey, joinedAt: at }],
			admins: [bob.publicKey],
			creator: bob.publicKey
		};
		await deliver(dave, forge(bob, groupId, 'adicionar', { targets: [dave.publicKey], state: fake }, [dave.publicKey], at));
		expect(await stateOf(dave, groupId)).toMatchObject({ creator: alice.publicKey });
		expect((await stateOf(dave, groupId)).members.map((m) => m.publicKey)).not.toContain(bob.publicKey);
	});

	it('o mesmo aviso duas vezes entra uma vez só', async () => {
		const alice = await person('Alice');
		const bob = await person('Bob');
		const created = wrap(alice, createGroup(alice.publicKey, 'Dupla', [bob.publicKey], 'Alice', tick()));
		const rumor = bob.vault.unwrap(created.toRecipients[0].wrap);
		expect(await storeGroupControl(bob.storage, bob.publicKey, rumor, clock)).toMatchObject({ isNew: true });
		expect(await storeGroupControl(bob.storage, bob.publicKey, rumor, clock)).toMatchObject({ isNew: false, joined: false });
	});
});

describe('dois administradores ao mesmo tempo', () => {
	// regressão: com a lista inteira em cada aviso, a mudança de um apagava a do outro
	it('Alice adiciona Dave enquanto Bob remove Carol: valem as duas, em todos os aparelhos', async () => {
		const { alice, bob, carol, groupId } = await family();
		const dave = await person('Dave');
		await act(alice, promoteAdmin(await conversationOf(alice, groupId), alice.publicKey, bob.publicKey, 'Alice', tick()), [bob, carol]);

		// cada um parte do que sabia, sem ter visto a mudança do outro
		const t = tick();
		const added = wrap(alice, addMembers(await conversationOf(alice, groupId), alice.publicKey, [dave.publicKey], 'Alice', t));
		const removed = wrap(bob, removeMember(await conversationOf(bob, groupId), bob.publicKey, carol.publicKey, 'Bob', t));
		const take = (p: Person, w: typeof added) => {
			const item = w.toRecipients.find((r) => r.recipient === p.publicKey);
			return storeGroupControl(p.storage, p.publicKey, item ? p.vault.unwrap(item.wrap) : w.rumor, clock);
		};
		await take(alice, added);
		await take(alice, removed);
		await take(bob, removed);
		await take(bob, added);
		await take(dave, added);
		await take(carol, removed);

		const members = async (p: Person) => (await stateOf(p, groupId)).members.map((m) => m.publicKey).sort();
		const expected = [alice.publicKey, bob.publicKey, dave.publicKey].sort();
		expect(await members(alice)).toEqual(expected);
		expect(await members(bob)).toEqual(expected);
		expect((await conversationOf(carol, groupId)).group!.amMember).toBe(false);
		// Dave entrou com a lista que Alice tinha, ainda com Carol: o aviso de Bob não foi para ele
		expect(await members(dave)).toContain(carol.publicKey);

		// Bob vê que Dave entrou e repassa o aviso dele; Dave fica igual aos outros
		const forwards = await takeForwards(bob.storage, await conversationOf(bob, groupId), bob.publicKey);
		expect(forwards.map((f) => f.to)).toEqual([[dave.publicKey]]);
		for (const { rumor, to } of forwards) {
			for (const { wrap: w } of bob.vault.rewrapGroupControl(rumor, to)) {
				await storeGroupControl(dave.storage, dave.publicKey, dave.vault.unwrap(w), clock);
			}
		}
		expect(await members(dave)).toEqual(expected);
		expect(await stateOf(dave, groupId)).toEqual(await stateOf(alice, groupId));
		// repasse feito uma vez só
		expect(await takeForwards(bob.storage, await conversationOf(bob, groupId), bob.publicKey)).toEqual([]);
	});
});

describe('repasse', () => {
	it('quem entra não recebe avisos antigos, que já estavam na lista que veio junto', async () => {
		const { alice, bob, carol, groupId } = await family();
		const dave = await person('Dave');
		await act(alice, promoteAdmin(await conversationOf(alice, groupId), alice.publicKey, bob.publicKey, 'Alice', tick()), [bob, carol]);
		clock += 2 * 24 * 60 * 60_000;
		await act(alice, addMembers(await conversationOf(alice, groupId), alice.publicKey, [dave.publicKey], 'Alice', tick()), [bob, carol, dave]);
		expect(await takeForwards(alice.storage, await conversationOf(alice, groupId), alice.publicKey)).toEqual([]);
	});
});

describe('aviso com horário falso (T17)', () => {
	async function bobRemoved() {
		const { alice, bob, carol, groupId } = await family();
		const dave = await person('Dave');
		await act(alice, addMembers(await conversationOf(alice, groupId), alice.publicKey, [dave.publicKey], 'Alice', tick()), [bob, carol, dave]);
		await act(alice, promoteAdmin(await conversationOf(alice, groupId), alice.publicKey, bob.publicKey, 'Alice', tick()), [bob, carol, dave]);
		const beforeRemoval = Math.floor(tick() / 1000);
		await act(alice, removeMember(await conversationOf(alice, groupId), alice.publicKey, bob.publicKey, 'Alice', tick()), [bob, carol, dave]);
		return { alice, bob, carol, dave, groupId, beforeRemoval };
	}

	it('administrador removido não "volta no tempo" para remover alguém', async () => {
		const { alice, bob, carol, dave, groupId, beforeRemoval } = await bobRemoved();
		const forged = forge(bob, groupId, 'remover', { targets: [carol.publicKey] }, [alice.publicKey, carol.publicKey, dave.publicKey], beforeRemoval);
		tick();
		for (const p of [alice, carol, dave]) await deliver(p, forged);
		for (const p of [alice, carol, dave]) expect((await stateOf(p, groupId)).members.map((m) => m.publicKey)).toContain(carol.publicKey);
	});

	it('nem para pôr um amigo e torná-lo administrador', async () => {
		const { alice, bob, carol, groupId, beforeRemoval } = await bobRemoved();
		const eve = await person('Eve');
		const state = await stateOf(carol, groupId);
		const withEve = { ...state, members: [...state.members, { publicKey: eve.publicKey, joinedAt: beforeRemoval }] };
		const add = forge(bob, groupId, 'adicionar', { targets: [eve.publicKey], state: withEve }, [alice.publicKey, carol.publicKey], beforeRemoval);
		const promote = forge(bob, groupId, 'promover', { targets: [eve.publicKey] }, [alice.publicKey, carol.publicKey], beforeRemoval);
		tick();
		for (const p of [alice, carol]) {
			await deliver(p, add);
			await deliver(p, promote);
			expect((await stateOf(p, groupId)).members.map((m) => m.publicKey)).not.toContain(eve.publicKey);
		}
	});

	it('o que ele fez de verdade antes de ser removido continua valendo', async () => {
		const { alice, bob, carol, groupId } = await family();
		await act(alice, promoteAdmin(await conversationOf(alice, groupId), alice.publicKey, bob.publicKey, 'Alice', tick()), [bob, carol]);
		await act(bob, renameGroup(await conversationOf(bob, groupId), bob.publicKey, 'Família Silva', 'Bob', tick()), [alice, carol]);
		await act(alice, removeMember(await conversationOf(alice, groupId), alice.publicKey, bob.publicKey, 'Alice', tick()), [bob, carol]);
		expect(await stateOf(carol, groupId)).toMatchObject({ name: 'Família Silva' });
	});
});

describe('voltar ao grupo', () => {
	it('quem é readicionado recebe a lista atual, com o que mudou enquanto estava fora', async () => {
		const { alice, bob, carol, groupId } = await family();
		const dave = await person('Dave');
		await act(alice, removeMember(await conversationOf(alice, groupId), alice.publicKey, carol.publicKey, 'Alice', tick()), [bob, carol]);
		await act(alice, addMembers(await conversationOf(alice, groupId), alice.publicKey, [dave.publicKey], 'Alice', tick()), [bob, dave]);
		await act(alice, renameGroup(await conversationOf(alice, groupId), alice.publicKey, 'Família 2', 'Alice', tick()), [bob, dave]);
		const { results } = await act(alice, addMembers(await conversationOf(alice, groupId), alice.publicKey, [carol.publicKey], 'Alice', tick()), [bob, carol, dave]);
		expect(results.get('Carol')).toMatchObject({ joined: true });
		expect(await stateOf(carol, groupId)).toEqual(await stateOf(bob, groupId));
		expect(await stateOf(carol, groupId)).toMatchObject({ name: 'Família 2' });
	});
});

describe('avisos na conversa', () => {
	it('cada mudança vira um aviso, com os nomes como cada um conhece', async () => {
		const { alice, bob, carol, groupId } = await family();
		await act(bob, introduce(await conversationOf(bob, groupId), 'Bob'), [alice, carol]);
		await act(alice, removeMember(await conversationOf(alice, groupId), alice.publicKey, bob.publicKey, 'Alice', tick()), [bob, carol]);
		const notices = async (p: Person) =>
			(await p.storage.messages.listByConversation(groupConversationId(groupId), 10)).map((m) => ({
				author: m.sender,
				action: m.notice?.action,
				targets: m.notice?.targets
			}));
		const expected = [
			{ author: alice.publicKey, action: 'criar', targets: [] },
			{ author: alice.publicKey, action: 'remover', targets: [bob.publicKey] }
		];
		for (const p of [alice, bob, carol]) expect(await notices(p)).toEqual(expected);
		expect((await conversationOf(carol, groupId)).lastNotice).toEqual({ author: alice.publicKey, notice: { action: 'remover', targets: [bob.publicKey] } });

		// os nomes, como cada um conhece: eu; quem não é contato, pelo nome que mandou ao grupo
		const namesFor = async (p: Person) => groupNames(p.storage, (await conversationOf(p, groupId)).group!, p.publicKey);
		expect((await namesFor(alice))(alice.publicKey)).toEqual({ me: true });
		expect((await namesFor(alice))(bob.publicKey)).toEqual({ name: 'Bob', contact: false });
		expect((await namesFor(bob))(alice.publicKey)).toEqual({ name: 'Alice', contact: false });
		expect((await namesFor(carol))(bob.publicKey)).toEqual({ name: 'Bob', contact: false });
	});

	it('aviso que não valeu não aparece', async () => {
		const { bob, carol, groupId } = await family();
		const forged = forge(bob, groupId, 'remover', { targets: [carol.publicKey] }, [carol.publicKey]);
		await deliver(carol, forged);
		const messages = await carol.storage.messages.listByConversation(groupConversationId(groupId), 10);
		expect(messages.map((m) => m.notice?.action)).toEqual(['criar']);
	});
});

describe('nomes dos membros', () => {
	it('quem entra se apresenta; o nome fica guardado no grupo, não nos contatos', async () => {
		const { alice, bob, carol, groupId } = await family();
		await act(bob, introduce(await conversationOf(bob, groupId), 'Bob'), [alice, carol]);
		expect((await conversationOf(carol, groupId)).group!.names[bob.publicKey]).toBe('Bob');
		expect(await carol.storage.contacts.get(bob.publicKey)).toBeUndefined();
	});

	it('se a apresentação se perder, o nome chega com a primeira mensagem', async () => {
		const { alice, bob, carol, groupId } = await family();
		const conversation = await conversationOf(bob, groupId);
		const wrapped = bob.vault.wrapGroupMessage(conversation.members, 'oi', [['g', groupId], ['nome', 'Bob']], 14, Math.floor(tick() / 1000));
		const item = wrapped.toRecipients.find((r) => r.recipient === carol.publicKey)!;
		await storeIncoming(carol.storage, carol.publicKey, carol.vault.unwrap(item.wrap));
		expect((await conversationOf(carol, groupId)).group!.names[bob.publicKey]).toBe('Bob');
		// e um aviso de grupo depois não apaga o nome
		await act(alice, renameGroup(await conversationOf(alice, groupId), alice.publicKey, 'Família 2', 'Alice', tick()), [bob, carol]);
		expect((await conversationOf(carol, groupId)).group!.names[bob.publicKey]).toBe('Bob');
	});

	it('um estranho não consegue dar nome a si mesmo no grupo', async () => {
		const { bob, groupId } = await family();
		const dave = await person('Dave');
		const wrapped = dave.vault.wrapGroupMessage([bob.publicKey], '', controlTags(groupId, 'apresentar', {}, 'Dave'), GROUP_CONTROL_KIND);
		await storeGroupControl(bob.storage, bob.publicKey, bob.vault.unwrap(wrapped.toRecipients[0].wrap), clock);
		expect((await conversationOf(bob, groupId)).group!.names[dave.publicKey]).toBeUndefined();
	});
});

describe('limites', () => {
	it('grupo de até 20 pessoas (RF-30)', async () => {
		const alice = await person('Alice');
		const others = Array.from({ length: 20 }, (_, i) => (i + 1).toString(16).padStart(64, '0'));
		expect(() => createGroup(alice.publicKey, 'Grande', others, 'Alice', tick())).toThrow(/até 20/);
		expect(() => createGroup(alice.publicKey, 'Cheio', others.slice(0, 19), 'Alice', tick())).not.toThrow();
	});
});

describe('avisos de grupo ao mesmo tempo', () => {
	// Visto no e2e de grupos: a Ana promove a Bia logo depois de adicionar gente, e a apresentação de quem acabou
	// de entrar chega no meio. Sem a vez (lock.ts) a gravação mais lenta apagava a promoção.
	it('uma ação minha e um aviso que chega juntos não apagam um ao outro', async () => {
		for (const mineFirst of [true, false]) {
			for (let delay = 0; delay <= 6; delay++) {
				const { alice, bob, carol, groupId } = await family();
				const mine = wrap(alice, promoteAdmin(await conversationOf(alice, groupId), alice.publicKey, bob.publicKey, 'Alice', tick()));
				const intro = wrap(carol, introduce(await conversationOf(carol, groupId), 'Carol'));
				const toAlice = (w: typeof intro) => alice.vault.unwrap(w.toRecipients.find((r) => r.recipient === alice.publicKey)!.wrap);
				const saveMine = () => storeGroupControl(alice.storage, alice.publicKey, mine.rumor, clock);
				const saveIntro = () => storeGroupControl(alice.storage, alice.publicKey, toAlice(intro), clock);

				const first = (mineFirst ? saveMine : saveIntro)();
				for (let i = 0; i < delay; i++) await new Promise((r) => setImmediate(r));
				const second = (mineFirst ? saveIntro : saveMine)();
				await Promise.all([first, second]);

				const conversation = await conversationOf(alice, groupId);
				expect(conversation.group!.state.admins, `minha ação primeiro=${mineFirst}, atraso=${delay}`).toContain(bob.publicKey);
				expect(conversation.group!.names[carol.publicKey], `minha ação primeiro=${mineFirst}, atraso=${delay}`).toBe('Carol');
			}
		}
	});
});
