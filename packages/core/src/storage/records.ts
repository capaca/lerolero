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
	/**
	 * Quem me pôs no grupo não é contato (RF-12): o grupo fica em Contatos, como pedido, até eu aceitar. `recusado` é o
	 * bloqueio: o grupo some e o que vier dele é descartado. Sem o campo, o grupo é normal.
	 */
	request?: { state: 'pedido' | 'recusado'; by: string };
};

export type ConversationRecord = {
	id: string;
	type: 'direta' | 'grupo';
	/** quem recebe o que eu mando: o contato, ou os outros membros do grupo */
	members: string[];
	/** só nos grupos */
	group?: GroupInfo;
	lastMessageAt: number;
	/** o texto da última mensagem, só quando ela é texto (storage/summary.ts) */
	lastMessagePreview?: string;
	/** tipo da última mensagem: a lista mostra o ícone e monta o texto na língua da pessoa (ADR-0008) */
	lastMessageKind?: 'texto' | 'audio' | 'foto' | 'arquivo' | 'apagada' | 'aviso';
	/** a última mensagem é um aviso de grupo: quem fez e o quê */
	lastNotice?: { author: string; notice: GroupNotice };
	unread: number;
	/** já mandei meu nome nesta conversa (tag "nome" na primeira mensagem) */
	nameSent?: boolean;
};

export type MessageStatus = 'pendente' | 'enviada' | 'recebida';

/** O que o destinatário confirmou de uma mensagem minha (docs/06 §3.4); `lida` vale também como entregue. */
export type Receipt = 'entregue' | 'lida';

/** Reação de uma pessoa a uma mensagem (kind 7, RF-23): uma por pessoa e mensagem, a mais recente vale. */
export type ReactionRecord = {
	/** id do rumor da reação: é o que um pedido de apagar (kind 5) cita para desfazê-la */
	id: string;
	messageId: string;
	conversationId: string;
	sender: string;
	emoji: string;
	createdAt: number;
};

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
	/** segundos de silêncio no começo do áudio, que o player pula (media/voice-start.ts) */
	start?: number;
	/** tamanho da foto em pixels, para o balão reservar o espaço antes de baixar (RF-41) */
	width?: number;
	height?: number;
	/** prévia da foto: JPEG minúsculo em base64, de até ~5 KB (RNF-24) */
	thumb?: string;
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
	/** resposta a outra mensagem da mesma conversa (RF-22): id do rumor citado */
	replyTo?: string;
	/** só nas minhas: o que cada destinatário já confirmou (RF-50); nos grupos, uma entrada por membro */
	receipts?: Record<string, Receipt>;
	/** só nas recebidas: o que eu já confirmei ao remetente, para não repetir */
	ack?: Receipt;
	/** favoritada por mim (RF-28): marca só deste aparelho, sem aviso a ninguém */
	starred?: boolean;
	/** editada por quem escreveu (RF-24): horário da edição que vale, em segundos */
	editedAt?: number;
	/** apagada para todos (RF-25): fica o aviso no lugar, sem conteúdo */
	deleted?: boolean;
	/** aviso de grupo ("Ana adicionou Bruno"); a tela monta o texto, com os nomes atuais e na língua da pessoa */
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

/**
 * Cartão de perfil de alguém (kind 4442, docs/06 §3.5, Q-P5): o mais recente que chegou de cada pessoa.
 * O meu fica aqui também, com a minha chave.
 */
export type ProfileRecord = {
	publicKey: string;
	name: string;
	/** foto de perfil (RF-02): cifrada no Blossom, com a prévia que viaja no próprio cartão */
	photo?: MessageMedia;
	/** relays de DM (NIP-17) onde a pessoa recebe */
	relays: string[];
	/** versão do app de quem mandou e o que ele sabe ler (RNF-93) */
	app?: string;
	features: string[];
	/** horário do cartão (rumor), em segundos: o mais novo vale */
	updatedAt: number;
};

export type SeenWrapRecord = { id: string; receivedAt: number };
