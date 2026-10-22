import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { KdfParams } from '../crypto/seal.ts';
import { createVault } from '../identity/vault.ts';
import { openStorage } from '../storage/repositories.ts';
import type { GroupState } from '../storage/records.ts';
import {
	addMembers,
	controlTags,
	createGroup,
	demoteAdmin,
	GROUP_CONTROL_KIND,
	groupConversationId,
	GroupPermissionError,
	introduce,
	leaveGroup,
	promoteAdmin,
	removeMember,
	renameGroup,
	storeGroupControl,
	successor,
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

/** Aviso forjado: alguém manda um estado à mão, sem passar pelas conferências do app. */
function forge(from: Person, groupId: string, state: GroupState, to: string[], createdAt = Math.floor(tick() / 1000)) {
	return from.vault.wrapGroupMessage(to, '', controlTags(groupId, 'adicionar', state), GROUP_CONTROL_KIND, createdAt);
}

describe('criar grupo e conversar', () => {
	it('quem foi adicionado ganha a conversa de grupo, com os membros e o criador', async () => {
		const { alice, bob, carol, groupId, results } = await family();
		expect(results.get('Bob')).toMatchObject({ isNew: true, joined: true });
		const bobs = await conversationOf(bob, groupId);
		expect(bobs).toMatchObject({ type: 'grupo', lastMessagePreview: 'Você foi adicionado ao grupo' });
		expect(bobs.members.sort()).toEqual([alice.publicKey, carol.publicKey].sort());
		expect(bobs.group).toMatchObject({ amMember: true, state: { name: 'Família', creator: alice.publicKey, admins: [alice.publicKey] } });
		// o nome de quem criou chega junto, cifrado só para o grupo
		expect(bobs.group!.names[alice.publicKey]).toBe('Alice');
		expect((await conversationOf(alice, groupId)).lastMessagePreview).toBe('Você criou o grupo');
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
		expect(messages.map((m) => m.text)).toEqual(['chegou primeiro']);
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
		const state = await stateOf(carol, groupId);
		const at = Math.floor(tick() / 1000);
		const forged = forge(bob, groupId, { ...state, members: [...state.members, { publicKey: dave.publicKey, joinedAt: at }] }, [carol.publicKey], at);
		await storeGroupControl(carol.storage, carol.publicKey, carol.vault.unwrap(forged.toRecipients[0].wrap), clock);
		expect((await stateOf(carol, groupId)).members.map((m) => m.publicKey)).not.toContain(dave.publicKey);
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

		// forjado: Bob tira Alice e se diz criador; Carol ignora
		const state = await stateOf(carol, groupId);
		const forged = forge(bob, groupId, { ...state, members: state.members.filter((m) => m.publicKey !== alice.publicKey), admins: [bob.publicKey, carol.publicKey], creator: bob.publicKey }, [carol.publicKey]);
		await storeGroupControl(carol.storage, carol.publicKey, carol.vault.unwrap(forged.toRecipients[0].wrap), clock);
		expect((await stateOf(carol, groupId)).creator).toBe(alice.publicKey);
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

	it('ninguém mexe na antiguidade: um membro novo não entra com horário antigo', async () => {
		const { alice, bob, carol, groupId } = await family();
		const dave = await person('Dave');
		const state = await stateOf(bob, groupId);
		// Alice é administradora, mas manda Dave "entrando" antes de todo mundo para herdar o grupo
		const forged = forge(alice, groupId, { ...state, members: [...state.members, { publicKey: dave.publicKey, joinedAt: 1 }] }, [bob.publicKey, carol.publicKey]);
		await storeGroupControl(bob.storage, bob.publicKey, bob.vault.unwrap(forged.toRecipients.find((r) => r.recipient === bob.publicKey)!.wrap), clock);
		expect((await stateOf(bob, groupId)).members.map((m) => m.publicKey)).not.toContain(dave.publicKey);
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

	it('o criador não passa o título para quem quiser', async () => {
		const { alice, bob, carol, groupId } = await family();
		const state = await stateOf(bob, groupId);
		const wrong = [bob.publicKey, carol.publicKey].sort()[1]; // não é o sucessor
		expect(successor(state, alice.publicKey)).not.toBe(wrong);
		const forged = alice.vault.wrapGroupMessage(
			[bob.publicKey],
			'',
			controlTags(groupId, 'sair', { ...state, members: state.members.filter((m) => m.publicKey !== alice.publicKey), admins: [wrong], creator: wrong }),
			GROUP_CONTROL_KIND,
			Math.floor(tick() / 1000)
		);
		await storeGroupControl(bob.storage, bob.publicKey, bob.vault.unwrap(forged.toRecipients[0].wrap), clock);
		expect((await stateOf(bob, groupId)).creator).toBe(alice.publicKey);
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
		const forged = forge(bob, groupId, fake, [dave.publicKey], at);
		await storeGroupControl(dave.storage, dave.publicKey, dave.vault.unwrap(forged.toRecipients[0].wrap), clock);
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

describe('nomes dos membros', () => {
	it('quem entra se apresenta; o nome fica guardado no grupo, não nos contatos', async () => {
		const { alice, bob, carol, groupId } = await family();
		await act(bob, introduce(await conversationOf(bob, groupId), 'Bob'), [alice, carol]);
		expect((await conversationOf(carol, groupId)).group!.names[bob.publicKey]).toBe('Bob');
		expect(await carol.storage.contacts.get(bob.publicKey)).toBeUndefined();
	});

	it('um estranho não consegue dar nome a si mesmo no grupo', async () => {
		const { bob, groupId } = await family();
		const dave = await person('Dave');
		const wrapped = dave.vault.wrapGroupMessage([bob.publicKey], '', controlTags(groupId, 'apresentar', undefined, 'Dave'), GROUP_CONTROL_KIND);
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
