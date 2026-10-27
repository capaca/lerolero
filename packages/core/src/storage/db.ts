import { Dexie, type EntityTable } from 'dexie';
import type {
	ContactRecord,
	ConversationRecord,
	GroupEventRecord,
	IdentityRecord,
	MediaRecord,
	MessageRecord,
	OutboxRecord,
	SeenWrapRecord,
	SettingRecord,
	SyncRecord
} from './records.ts';
import { summaryOf } from './summary.ts';

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
	group_events!: EntityTable<GroupEventRecord, 'id'>;

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
		// exclusão: achar as mensagens que usam um arquivo, para não apagar arquivo em uso
		this.version(3).stores({ messages: 'id, [conversationId+createdAt], status, media.ox' });
		// grupos: os avisos de cada grupo, para refazer o estado (as conversas só ganham campos novos)
		this.version(4).stores({ group_events: 'id, groupId' });
		// a prévia da lista deixa de guardar frases em português ("Áudio", avisos de grupo): guarda o tipo e
		// a tela monta o texto na língua da pessoa (ADR-0008). Refaz o resumo de cada conversa a partir da
		// última mensagem.
		this.version(5).upgrade(async (tx) => {
			const conversations = tx.table<ConversationRecord, string>('conversations');
			const messages = tx.table<MessageRecord, string>('messages');
			for (const conversation of await conversations.toArray()) {
				const latest = await messages
					.where('[conversationId+createdAt]')
					.between([conversation.id, Dexie.minKey], [conversation.id, Dexie.maxKey])
					.last();
				await conversations.put({ ...conversation, ...summaryOf(latest) });
			}
		});
	}
}
