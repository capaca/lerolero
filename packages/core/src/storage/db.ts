import { Dexie, type EntityTable } from 'dexie';
import type {
	ContactRecord,
	ConversationRecord,
	IdentityRecord,
	MediaRecord,
	MessageRecord,
	OutboxRecord,
	SeenWrapRecord,
	SettingRecord,
	SyncRecord
} from './records.ts';

/** Acesso cru ao IndexedDB. Só os repositórios (repositories.ts) usam esta classe (ADR-0003). */
export class LeroleroDb extends Dexie {
	identity!: EntityTable<IdentityRecord, 'id'>;
	settings!: EntityTable<SettingRecord, 'key'>;
	contacts!: EntityTable<ContactRecord, 'publicKey'>;
	conversations!: EntityTable<ConversationRecord, 'id'>;
	messages!: EntityTable<MessageRecord, 'id'>;
	outbox!: EntityTable<OutboxRecord, 'id'>;
	sync!: EntityTable<SyncRecord, 'relay'>;
	seen_wraps!: EntityTable<SeenWrapRecord, 'id'>;
	media!: EntityTable<MediaRecord, 'ox'>;

	constructor(name = 'lerolero') {
		super(name);
		this.version(1).stores({
			identity: 'id',
			settings: 'key',
			contacts: 'publicKey, state',
			conversations: 'id, lastMessageAt',
			messages: 'id, [conversationId+createdAt], status',
			outbox: 'id, nextAttemptAt',
			sync: 'relay',
			seen_wraps: 'id, receivedAt'
		});
		// M2: mídia (as tabelas anteriores seguem iguais; o Dexie migra sozinho)
		this.version(2).stores({ media: 'ox, lastAccess' });
	}
}
