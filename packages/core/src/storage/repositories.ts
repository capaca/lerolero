// Repositórios: a única porta de entrada para os dados do aparelho (ADR-0003).
// O resto do núcleo depende só destas interfaces, para o banco poder ser trocado
// (ex.: SQLite nativo na v1) sem mexer em quem usa.

import { LeroleroDb } from './db.ts';
import type {
	ContactRecord,
	ConversationRecord,
	IdentityRecord,
	MediaRecord,
	MessageRecord,
	OutboxRecord,
	SeenWrapRecord
} from './records.ts';

export interface IdentityRepository {
	get(): Promise<IdentityRecord | undefined>;
	put(identity: IdentityRecord): Promise<void>;
}

export interface SettingsRepository {
	get<T>(key: string): Promise<T | undefined>;
	set(key: string, value: unknown): Promise<void>;
}

export interface ContactRepository {
	get(publicKey: string): Promise<ContactRecord | undefined>;
	put(contact: ContactRecord): Promise<void>;
	list(): Promise<ContactRecord[]>;
}

export interface ConversationRepository {
	get(id: string): Promise<ConversationRecord | undefined>;
	put(conversation: ConversationRecord): Promise<void>;
	/** mais recente primeiro (RF-21) */
	listByRecent(): Promise<ConversationRecord[]>;
}

export interface MessageRepository {
	get(id: string): Promise<MessageRecord | undefined>;
	put(message: MessageRecord): Promise<void>;
	/** as `limit` mais recentes antes de `before` (segundos), em ordem cronológica */
	listByConversation(conversationId: string, limit: number, before?: number): Promise<MessageRecord[]>;
}

export interface OutboxRepository {
	put(item: OutboxRecord): Promise<void>;
	/** itens cuja próxima tentativa já chegou, mais antigos primeiro */
	due(now: number): Promise<OutboxRecord[]>;
	delete(id: string): Promise<void>;
}

export interface SyncRepository {
	getCursor(relay: string): Promise<number | undefined>;
	setCursor(relay: string, cursor: number): Promise<void>;
}

export interface SeenWrapRepository {
	has(id: string): Promise<boolean>;
	add(wrap: SeenWrapRecord): Promise<void>;
	/** apaga os registros recebidos antes de `before` (segundos); devolve quantos */
	prune(before: number): Promise<number>;
}

export interface MediaRepository {
	get(ox: string): Promise<MediaRecord | undefined>;
	put(media: MediaRecord): Promise<void>;
	/** marca o último acesso (a expiração apaga o que ficou muito tempo sem uso, RF-72) */
	touch(ox: string, at: number): Promise<void>;
}

export type Storage = {
	identity: IdentityRepository;
	settings: SettingsRepository;
	contacts: ContactRepository;
	conversations: ConversationRepository;
	messages: MessageRepository;
	outbox: OutboxRepository;
	sync: SyncRepository;
	seenWraps: SeenWrapRepository;
	media: MediaRepository;
	close(): void;
};

export function openStorage(name?: string): Storage {
	const db = new LeroleroDb(name);
	return {
		identity: {
			get: () => db.identity.get('eu'),
			put: async (identity) => void (await db.identity.put(identity))
		},
		settings: {
			get: async <T>(key: string) => (await db.settings.get(key))?.value as T | undefined,
			set: async (key, value) => void (await db.settings.put({ key, value }))
		},
		contacts: {
			get: (publicKey) => db.contacts.get(publicKey),
			put: async (contact) => void (await db.contacts.put(contact)),
			list: () => db.contacts.toArray()
		},
		conversations: {
			get: (id) => db.conversations.get(id),
			put: async (conversation) => void (await db.conversations.put(conversation)),
			listByRecent: () => db.conversations.orderBy('lastMessageAt').reverse().toArray()
		},
		messages: {
			get: (id) => db.messages.get(id),
			put: async (message) => void (await db.messages.put(message)),
			listByConversation: async (conversationId, limit, before = Infinity) => {
				const newestFirst = await db.messages
					.where('[conversationId+createdAt]')
					.between([conversationId, -Infinity], [conversationId, before], true, false)
					.reverse()
					.limit(limit)
					.toArray();
				return newestFirst.reverse();
			}
		},
		outbox: {
			put: async (item) => void (await db.outbox.put(item)),
			due: (now) => db.outbox.where('nextAttemptAt').belowOrEqual(now).sortBy('nextAttemptAt'),
			delete: (id) => db.outbox.delete(id)
		},
		sync: {
			getCursor: async (relay) => (await db.sync.get(relay))?.cursor,
			setCursor: async (relay, cursor) => void (await db.sync.put({ relay, cursor }))
		},
		seenWraps: {
			has: async (id) => (await db.seen_wraps.get(id)) !== undefined,
			add: async (wrap) => void (await db.seen_wraps.put(wrap)),
			prune: (before) => db.seen_wraps.where('receivedAt').below(before).delete()
		},
		media: {
			get: (ox) => db.media.get(ox),
			put: async (media) => void (await db.media.put(media)),
			touch: async (ox, at) => void (await db.media.update(ox, { lastAccess: at }))
		},
		close: () => db.close()
	};
}
