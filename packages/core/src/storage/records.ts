// Formato dos dados guardados no aparelho (docs/06-protocolo-e-dados.md §4).
// Só as tabelas do M1; as demais (reações, mídia) entram por migração quando chegarem.

import type { NostrEvent } from 'nostr-tools/pure';
import type { Sealed } from '../crypto/seal.ts';

export type IdentityRecord = {
	/** sempre 'eu': uma identidade por aparelho */
	id: 'eu';
	publicKey: string;
	/** frase de recuperação lacrada com o PIN; a chave privada é derivada dela (NIP-06) */
	phrase: Sealed;
	phraseConfirmed: boolean;
	displayName: string;
	createdAt: number;
};

export type SettingRecord = { key: string; value: unknown };

export type ContactState = 'aceito' | 'pedido' | 'bloqueado';

export type ContactRecord = {
	publicKey: string;
	/** nome dado por quem usa o app; prevalece sobre o escolhido pelo contato (RF-14) */
	localName?: string;
	chosenName?: string;
	state: ContactState;
	dmRelays: string[];
	addedAt: number;
};

export type ConversationRecord = {
	id: string;
	type: 'direta';
	members: string[];
	lastMessageAt: number;
	lastMessagePreview?: string;
	unread: number;
};

export type MessageStatus = 'pendente' | 'enviada' | 'recebida';

export type MessageRecord = {
	/** id do rumor */
	id: string;
	conversationId: string;
	sender: string;
	kind: number;
	text: string;
	/** horário real (do rumor), em segundos */
	createdAt: number;
	status: MessageStatus;
};

export type OutboxRecord = {
	/** id do gift wrap */
	id: string;
	event: NostrEvent;
	relays: string[];
	/** relays que já confirmaram com OK */
	acceptedBy: string[];
	messageId?: string;
	attempts: number;
	nextAttemptAt: number;
};

export type SyncRecord = { relay: string; cursor: number };

export type SeenWrapRecord = { id: string; receivedAt: number };
