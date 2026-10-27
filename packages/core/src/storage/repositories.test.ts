import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openStorage, type Storage } from './repositories.ts';
import type { MessageRecord } from './records.ts';

let storage: Storage;
let n = 0;
beforeEach(() => {
	storage = openStorage(`teste-${n++}`);
});
afterEach(() => storage.close());

const message = (id: string, conversationId: string, createdAt: number): MessageRecord => ({
	id,
	conversationId,
	sender: 'a',
	kind: 14,
	text: id,
	createdAt,
	status: 'recebida'
});

describe('repositórios', () => {
	it('lista conversas da mais recente para a mais antiga', async () => {
		await storage.conversations.put({ id: 'velha', type: 'direta', members: [], lastMessageAt: 10, unread: 0 });
		await storage.conversations.put({ id: 'nova', type: 'direta', members: [], lastMessageAt: 20, unread: 2 });
		expect((await storage.conversations.listByRecent()).map((c) => c.id)).toEqual(['nova', 'velha']);
	});

	it('pagina as mensagens de uma conversa em ordem cronológica, sem misturar conversas', async () => {
		for (let t = 1; t <= 5; t++) await storage.messages.put(message(`m${t}`, 'c1', t));
		await storage.messages.put(message('outra', 'c2', 3));
		expect((await storage.messages.listByConversation('c1', 2)).map((m) => m.id)).toEqual(['m4', 'm5']);
		expect((await storage.messages.listByConversation('c1', 2, 4)).map((m) => m.id)).toEqual(['m2', 'm3']);
	});

	it('entrega da fila só o que já pode ser tentado de novo, mais antigo primeiro', async () => {
		const item = (id: string, nextAttemptAt: number) => ({
			id,
			event: {} as never,
			relays: [],
			acceptedBy: [],
			attempts: 0,
			nextAttemptAt
		});
		await storage.outbox.put(item('depois', 300));
		await storage.outbox.put(item('b', 200));
		await storage.outbox.put(item('a', 100));
		expect((await storage.outbox.due(250)).map((i) => i.id)).toEqual(['a', 'b']);
		await storage.outbox.delete('a');
		expect((await storage.outbox.due(250)).map((i) => i.id)).toEqual(['b']);
	});

	it('guarda cursores e limpa gift wraps vistos antigos', async () => {
		await storage.sync.setCursor('wss://r', 123);
		expect(await storage.sync.getCursor('wss://r')).toBe(123);
		expect(await storage.sync.getCursor('wss://outro')).toBeUndefined();

		await storage.seenWraps.add({ id: 'velho', receivedAt: 10 });
		await storage.seenWraps.add({ id: 'novo', receivedAt: 100 });
		expect(await storage.seenWraps.prune(50)).toBe(1);
		expect(await storage.seenWraps.has('velho')).toBe(false);
		expect(await storage.seenWraps.has('novo')).toBe(true);
	});

	it('guarda configurações de qualquer tipo', async () => {
		await storage.settings.set('confirmacaoDeLeitura', false);
		expect(await storage.settings.get<boolean>('confirmacaoDeLeitura')).toBe(false);
		expect(await storage.settings.get('inexistente')).toBeUndefined();
	});
});

describe('migração do banco', () => {
	it('da versão 3 para a 4 (grupos): mensagens, conversas e ajustes continuam', async () => {
		const { Dexie } = await import('dexie');
		const name = 'migracao-v3';
		// o banco como estava publicado antes dos grupos
		const old = new Dexie(name);
		old.version(3).stores({
			identity: 'id',
			settings: 'key',
			contacts: 'publicKey, state',
			conversations: 'id, lastMessageAt',
			messages: 'id, [conversationId+createdAt], status, media.ox',
			outbox: 'id, nextAttemptAt',
			sync: 'relay',
			seen_wraps: 'id, receivedAt',
			media: 'ox, lastAccess'
		});
		await old.table('conversations').put({ id: 'direta:b', type: 'direta', members: ['b'], lastMessageAt: 5, unread: 1 });
		await old.table('messages').put(message('m1', 'direta:b', 5));
		await old.table('settings').put({ key: 'geracaoSync', value: 3 });
		old.close();

		const upgraded = openStorage(name);
		expect(await upgraded.conversations.get('direta:b')).toMatchObject({ unread: 1 });
		expect((await upgraded.messages.listByConversation('direta:b', 10)).map((m) => m.id)).toEqual(['m1']);
		expect(await upgraded.settings.get('geracaoSync')).toBe(3);
		expect(await upgraded.groupEvents.listByGroup('x')).toEqual([]);
		upgraded.close();
	});

	it('da versão 4 para a 5: a prévia guarda o tipo, não frases em português (ADR-0008)', async () => {
		const { Dexie } = await import('dexie');
		const name = 'migracao-v4';
		const old = new Dexie(name);
		old.version(4).stores({
			identity: 'id',
			settings: 'key',
			contacts: 'publicKey, state',
			conversations: 'id, lastMessageAt',
			messages: 'id, [conversationId+createdAt], status, media.ox',
			outbox: 'id, nextAttemptAt',
			sync: 'relay',
			seen_wraps: 'id, receivedAt',
			media: 'ox, lastAccess',
			group_events: 'id, groupId'
		});
		const audio = { ox: 'o', x: 'x', type: 'audio/ogg', size: 1, urls: [], key: 'k', nonce: 'n' };
		const notice = { action: 'adicionar', targets: ['c'] };
		const conversations = old.table('conversations');
		const messages = old.table('messages');
		// como a versão 4 gravava: a frase pronta na prévia, e 'texto' para apagada e aviso
		await conversations.bulkPut([
			{ id: 'texto', type: 'direta', members: [], lastMessageAt: 2, lastMessagePreview: 'oi', lastMessageKind: 'texto', unread: 0 },
			{ id: 'audio', type: 'direta', members: [], lastMessageAt: 2, lastMessagePreview: 'Áudio', lastMessageKind: 'audio', unread: 0 },
			{ id: 'apagada', type: 'direta', members: [], lastMessageAt: 2, lastMessagePreview: 'Mensagem apagada', lastMessageKind: 'texto', unread: 0 },
			{ id: 'grupo', type: 'grupo', members: [], lastMessageAt: 2, lastMessagePreview: '~Ana adicionou ~Caio', lastMessageKind: 'texto', unread: 0 }
		]);
		await messages.bulkPut([
			{ ...message('t1', 'texto', 1), text: 'antiga' },
			{ ...message('t2', 'texto', 2), text: '  oi\n  tudo bem? ' },
			{ ...message('a1', 'audio', 2), kind: 15, text: '', media: audio },
			{ ...message('d1', 'apagada', 2), text: '', deleted: true },
			{ ...message('n1', 'grupo', 2), sender: 'ana', kind: 4440, text: '~Ana adicionou ~Caio', notice }
		]);
		old.close();

		const upgraded = openStorage(name);
		const summary = async (id: string) => {
			const { lastMessagePreview, lastMessageKind, lastNotice } = (await upgraded.conversations.get(id))!;
			return { lastMessagePreview, lastMessageKind, lastNotice };
		};
		expect(await summary('texto')).toEqual({ lastMessagePreview: 'oi tudo bem?', lastMessageKind: 'texto', lastNotice: undefined });
		expect(await summary('audio')).toEqual({ lastMessagePreview: undefined, lastMessageKind: 'audio', lastNotice: undefined });
		expect(await summary('apagada')).toEqual({ lastMessagePreview: undefined, lastMessageKind: 'apagada', lastNotice: undefined });
		expect(await summary('grupo')).toEqual({ lastMessagePreview: undefined, lastMessageKind: 'aviso', lastNotice: { author: 'ana', notice } });
		upgraded.close();
	});
});
