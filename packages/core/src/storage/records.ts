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

/** Membro de grupo; a antiguidade decide quem herda o título de criador (docs/06 §3.3). */
export type GroupMember = { publicKey: string; joinedAt: number };

/** Estado de um grupo; vai inteiro no aviso de criação e no que adiciona alguém (kind 4440). */
export type GroupState = {
	name: string;
	members: GroupMember[];
	/** inclui o criador */
	admins: string[];
	creator: string;
};

export type GroupInfo = {
	state: GroupState;
	/** nome que cada membro mandou (ação `apresentar`); quem não é contato aparece como "~Nome" */
	names: Record<string, string>;
	/** quem já foi membro: mensagens antigas dele continuam valendo depois que sai */
	everMembers: string[];
	/** eu ainda estou no grupo */
	amMember: boolean;
};

export type ConversationRecord = {
	id: string;
	type: 'direta' | 'grupo';
	/** quem recebe o que eu mando: o contato, ou os outros membros do grupo */
	members: string[];
	/** só nos grupos */
	group?: GroupInfo;
	lastMessageAt: number;
	lastMessagePreview?: string;
	/** tipo da última mensagem, para a lista mostrar o ícone certo */
	lastMessageKind?: 'texto' | 'audio' | 'arquivo';
	unread: number;
	/** já mandei meu nome nesta conversa (tag "nome" na primeira mensagem) */
	nameSent?: boolean;
};

export type MessageStatus = 'pendente' | 'enviada' | 'recebida';

/** Arquivo anexado a uma mensagem kind 15: o suficiente para baixar, conferir e decifrar. */
export type MessageMedia = {
	ox: string;
	x: string;
	type: string;
	size: number;
	urls: string[];
	key: string;
	nonce: string;
	/** duração em segundos (áudio) */
	duration?: number;
};

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
	/** presente nas mensagens de arquivo (kind 15) */
	media?: MessageMedia;
	/**
	 * Áudio que ainda sobe para os servidores Blossom: o balão provisório (id `envio:...`) aparece na hora e a
	 * mensagem de verdade só nasce depois do envio. `failed`: desistiu depois de tentar por alguns minutos.
	 */
	upload?: { startedAt: number; attempts: number; nextAttemptAt: number; failed?: boolean };
	/** apagada para todos (RF-25): fica o aviso no lugar, sem conteúdo */
	deleted?: boolean;
	/** aviso de grupo ("Ana adicionou Bruno"); o texto é refeito com os nomes atuais na tela */
	notice?: GroupNotice;
};

export type GroupNotice = { action: string; targets: string[]; subject?: string };

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
	/** quando entrou na fila (ms, crescente): a fila sai na ordem em que as mensagens foram escritas */
	queuedAt?: number;
};

export type SyncRecord = { relay: string; cursor: number };

/**
 * Mídia no aparelho (docs/06 §4), indexada pelo hash do original (`ox`): a mesma foto
 * recebida em várias conversas é baixada e guardada uma vez só (RF-70, RNF-27).
 */
export type MediaRecord = {
	/** SHA-256 do arquivo original, em hex */
	ox: string;
	type: string;
	size: number;
	/** o arquivo original; ausente quando já expirou do aparelho (RF-72) */
	file?: Blob;
	/** onde está o arquivo cifrado */
	urls: string[];
	/** SHA-256 do arquivo cifrado, em hex */
	x: string;
	/** chave e nonce do AES-GCM, em hex */
	key: string;
	nonce: string;
	/** marcada para não expirar */
	keep: boolean;
	lastAccess: number;
};

/** Aviso de grupo já conferido e guardado: o estado do grupo é refeito a partir deles. */
export type GroupEventRecord = {
	/** id do rumor */
	id: string;
	groupId: string;
	author: string;
	createdAt: number;
	/** quando chegou a este aparelho (ms); decide o ponto de partida de quem entrou depois */
	receivedAt: number;
	action: string;
	/** quem foi adicionado, removido, promovido ou rebaixado */
	targets: string[];
	/** novo nome do grupo (renomear) */
	subject?: string;
	/** lista completa, só na criação e para quem é adicionado */
	state?: GroupState;
	/** quem recebeu o aviso (tags `p`); quem entrou depois e não recebeu ganha um repasse */
	recipients: string[];
	/** o próprio rumor, só nos avisos que eu fiz: é o que eu repasso */
	rumor?: Omit<NostrEvent, 'sig'>;
	/** nome que o autor mandou junto */
	name?: string;
};

export type SeenWrapRecord = { id: string; receivedAt: number };
