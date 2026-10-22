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
