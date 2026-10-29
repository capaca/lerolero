import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket as NodeWebSocket } from 'ws';
import type { KdfParams } from '../crypto/seal.ts';
import { BACKUP_KIND, createVault } from '../identity/vault.ts';
import { createGroup, GROUP_CONTROL_KIND, groupConversationId, renameGroup, storeGroupControl, type GroupChange } from '../conversations/groups.ts';
import type { SocketFactory } from '../net/connection.ts';
import { RelayPool } from '../net/pool.ts';
import { openStorage } from '../storage/repositories.ts';
import type { MessageMedia } from '../storage/records.ts';
import { FakeRelay } from '../testing/fake-relay.ts';
import { applyBackup, backupChanged, backupContent, buildBackup, fetchBackup, parseBackup } from './backup.ts';

const FAST: KdfParams = { memoryKiB: 64, iterations: 1, parallelism: 1 };
const socket: SocketFactory = (url) => new NodeWebSocket(url) as unknown as WebSocket;
const cleanup: Array<() => unknown> = [];
afterEach(async () => {
	for (const fn of cleanup.splice(0).reverse()) await fn();
});

let n = 0;
function newStorage() {
	const storage = openStorage(`backup-${n++}`);
	cleanup.push(() => storage.close());
	return storage;
}

async function person(name: string) {
	const vault = createVault({ kdf: FAST });
	const { publicKey, phrase, words } = await vault.create('123456');
	const storage = newStorage();
	await storage.identity.put({ id: 'eu', publicKey, phrase, phraseConfirmed: true, displayName: name, createdAt: 1 });
	return { name, vault, publicKey, words, storage };
}
type Person = Awaited<ReturnType<typeof person>>;

/** O mesmo dono num aparelho novo: a mesma frase, banco vazio. */
async function newDevice(p: Person) {
	const vault = createVault({ kdf: FAST });
	await vault.restore(p.words, '654321');
	return { vault, storage: newStorage() };
}

const PHOTO: MessageMedia = {
	ox: 'a'.repeat(64),
	x: 'b'.repeat(64),
	type: 'image/jpeg',
	size: 30_000,
	urls: ['https://blossom.example/' + 'b'.repeat(64)],
	key: 'c'.repeat(64),
	nonce: 'd'.repeat(24)
};

let clock = 1_800_000_000_000;
const tick = () => (clock += 60_000);

/** Embrulha o aviso como o app faz, guarda na cópia de quem fez e entrega a cada um. */
async function act(from: Person, change: GroupChange, to: Person[]) {
	const wrapped = from.vault.wrapGroupMessage(change.recipients, '', change.tags, GROUP_CONTROL_KIND, change.createdAt);
	await storeGroupControl(from.storage, from.publicKey, wrapped.rumor, clock);
	for (const p of to) {
		const item = wrapped.toRecipients.find((r) => r.recipient === p.publicKey)!;
		await storeGroupControl(p.storage, p.publicKey, p.vault.unwrap(item.wrap), clock);
	}
	return wrapped;
}

/** Ana tem Bia como contato (com o nome que deu a ela), Caio bloqueado, Davi como pedido e um grupo com Bia. */
async function scene() {
	const [ana, bia, caio, davi] = await Promise.all([person('Ana'), person('Bia'), person('Caio'), person('Davi')]);
	await ana.storage.contacts.put({
		publicKey: bia.publicKey,
		localName: 'Bia do trabalho',
		chosenName: 'Bia',
		state: 'aceito',
		dmRelays: ['wss://r.example'],
		addedAt: 10
	});
	await ana.storage.contacts.put({ publicKey: caio.publicKey, state: 'bloqueado', dmRelays: [], addedAt: 11 });
	await ana.storage.contacts.put({ publicKey: davi.publicKey, chosenName: 'Davi', state: 'pedido', dmRelays: [], addedAt: 12 });
	await ana.storage.profiles.put({ publicKey: ana.publicKey, name: 'Ana', photo: PHOTO, relays: [], features: [], updatedAt: 500 });
	await ana.storage.settings.set('confirmacaoLeitura', false);
	await ana.storage.settings.set('meusRelaysDm', ['wss://meu.example']);
	await ana.storage.settings.set('tentativasPin', { failures: 3 });
	const created = createGroup(ana.publicKey, 'Família', [bia.publicKey], 'Ana', tick());
	await act(ana, created, [bia]);
	return { ana, bia, caio, davi, groupId: created.groupId };
}

describe('backup cifrado (RF-06)', () => {
	it('só o dono abre, e o cofre recusa backup de outra chave ou adulterado', async () => {
		const [ana, bia] = await Promise.all([person('Ana'), person('Bia')]);
		const event = ana.vault.sealBackup('{"segredo":"Bia do trabalho"}');
		expect(event.kind).toBe(BACKUP_KIND);
		expect(event.content).not.toContain('Bia');
		expect((await newDevice(ana)).vault.openBackup(event)).toBe('{"segredo":"Bia do trabalho"}');
		expect(() => bia.vault.openBackup(event)).toThrow();
		expect(() => ana.vault.openBackup({ ...event, created_at: event.created_at + 1 })).toThrow();
		// o sign genérico continua sem assinar o kind do backup
		expect(() => ana.vault.sign({ kind: BACKUP_KIND, created_at: 1, tags: [], content: '' })).toThrow();
	});

	it('leva perfil, contatos aceitos e bloqueados, grupos e só os ajustes da pessoa; nada de pedidos', async () => {
		const { ana, bia, caio, davi, groupId } = await scene();
		const backup = await buildBackup(ana.storage, ana.publicKey, clock);
		expect(backup.profile).toEqual({ name: 'Ana', photo: PHOTO, updatedAt: 500 });
		expect(backup.contacts.map((c) => c.publicKey).sort()).toEqual([bia.publicKey, caio.publicKey].sort());
		expect(backup.contacts.map((c) => c.publicKey)).not.toContain(davi.publicKey);
		expect(backup.groups).toEqual([expect.objectContaining({ id: groupId, state: expect.objectContaining({ name: 'Família' }) })]);
		expect(backup.settings).toEqual({ confirmacaoLeitura: false, meusRelaysDm: ['wss://meu.example'] });
	});

	it('num aparelho novo, volta tudo; e o grupo segue recebendo mudanças a partir do backup', async () => {
		const { ana, bia, caio, groupId } = await scene();
		const content = backupContent(await buildBackup(ana.storage, ana.publicKey, clock));
		const event = ana.vault.sealBackup(content, Math.floor(clock / 1000));

		const novo = await newDevice(ana);
		await applyBackup(novo.storage, ana.publicKey, parseBackup(novo.vault.openBackup(event))!);

		expect(await novo.storage.contacts.get(bia.publicKey)).toMatchObject({ localName: 'Bia do trabalho', state: 'aceito' });
		expect((await novo.storage.contacts.get(caio.publicKey))?.state).toBe('bloqueado');
		expect(await novo.storage.settings.get('confirmacaoLeitura')).toBe(false);
		expect(await novo.storage.settings.get('tentativasPin')).toBeUndefined();
		const id = groupConversationId(groupId);
		const group = await novo.storage.conversations.get(id);
		expect(group?.group).toMatchObject({ amMember: true, state: { name: 'Família' } });
		expect(group?.members).toEqual([bia.publicKey]);
		// o ponto de partida não vira aviso na conversa
		expect(await novo.storage.messages.listByConversation(id, 10)).toEqual([]);

		// Ana renomeia no aparelho antigo; a cópia dela chega ao novo, que aplica sobre o estado do backup
		tick();
		const rename = renameGroup((await ana.storage.conversations.get(id))!, ana.publicKey, 'Família Silva', 'Ana', clock);
		const wrapped = await act(ana, rename, [bia]);
		await storeGroupControl(novo.storage, ana.publicKey, novo.vault.unwrap(wrapped.toSelf), clock);
		expect((await novo.storage.conversations.get(id))?.group?.state.name).toBe('Família Silva');
	});

	it('junta ao que a sincronização já trouxe: o pedido volta a ser contato e o que foi decidido aqui fica', async () => {
		const { ana, bia, caio } = await scene();
		const backup = await buildBackup(ana.storage, ana.publicKey, clock);
		const novo = await newDevice(ana);
		await novo.storage.contacts.put({ publicKey: bia.publicKey, chosenName: 'Bia', state: 'pedido', dmRelays: ['wss://novo.example'], addedAt: 99 });
		await novo.storage.contacts.put({ publicKey: caio.publicKey, localName: 'Caio', state: 'aceito', dmRelays: [], addedAt: 99 });
		await novo.storage.settings.set('confirmacaoLeitura', true);
		await applyBackup(novo.storage, ana.publicKey, backup);
		expect(await novo.storage.contacts.get(bia.publicKey)).toMatchObject({
			state: 'aceito',
			localName: 'Bia do trabalho',
			dmRelays: ['wss://novo.example'],
			addedAt: 10
		});
		expect(await novo.storage.contacts.get(caio.publicKey)).toMatchObject({ state: 'aceito', localName: 'Caio' });
		expect(await novo.storage.settings.get('confirmacaoLeitura')).toBe(true);
	});

	it('descarta o que não tem o formato esperado', () => {
		expect(parseBackup('não é json')).toBeUndefined();
		expect(parseBackup('{"v":2,"profile":{}}')).toBeUndefined();
		const parsed = parseBackup(
			JSON.stringify({
				v: 1,
				createdAt: 1,
				profile: { name: 'Ana' },
				contacts: [{ publicKey: 'x', state: 'aceito', dmRelays: [], addedAt: 1 }],
				groups: [{ id: 'nada' }],
				settings: { confirmacaoLeitura: true, tentativasPin: 0 }
			})
		);
		expect(parsed).toMatchObject({ contacts: [], groups: [], settings: { confirmacaoLeitura: true } });
		expect(parsed?.settings).not.toHaveProperty('tentativasPin');
	});

	it('só conta como mudança o que mudou de fato, não o horário', async () => {
		const { ana, bia } = await scene();
		const first = await buildBackup(ana.storage, ana.publicKey, clock);
		const published = backupContent(first);
		expect(backupChanged(undefined, first)).toBe(true);
		expect(backupChanged(published, await buildBackup(ana.storage, ana.publicKey, tick()))).toBe(false);
		await ana.storage.contacts.put({ ...(await ana.storage.contacts.get(bia.publicKey))!, localName: 'Bia' });
		expect(backupChanged(published, await buildBackup(ana.storage, ana.publicKey, tick()))).toBe(true);
	});

	it('nos relays: acha o mais novo; sem relay respondendo, avisa que não dá para saber', async () => {
		const ana = await person('Ana');
		const relay = await new FakeRelay().start();
		cleanup.push(() => relay.stop());
		const pool = new RelayPool({ signer: async (t) => ana.vault.sign(t), socket, timeoutMs: 1000, reconnectDelaysMs: [50] });
		cleanup.push(() => pool.close());

		expect(await fetchBackup(pool, [relay.url], ana.publicKey)).toEqual({ events: [], answered: true });
		await pool.publish([relay.url], ana.vault.sealBackup('{"v":1,"a":1}', 100));
		await pool.publish([relay.url], ana.vault.sealBackup('{"v":1,"a":2}', 200));
		const { events } = await fetchBackup(pool, [relay.url], ana.publicKey);
		expect(events).toHaveLength(1);
		expect(ana.vault.openBackup(events[0]!)).toBe('{"v":1,"a":2}');

		expect((await fetchBackup(pool, ['ws://127.0.0.1:1'], ana.publicKey)).answered).toBe(false);
	});
});
