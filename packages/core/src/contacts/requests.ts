// Pedidos de mensagem e bloqueio (RF-12, RF-13, T7). Quem escreve sem ser contato fica como "pedido": a conversa
// some da lista e vai para Contatos, sem links nem áudio abertos, até a pessoa aceitar. Bloquear apaga a conversa e
// descarta o que vier dessa chave (messaging.ts, storeIncoming).

import { clearConversation, deleteConversation, directConversationId } from '../conversations/messaging.ts';
import type { ContactRecord, ConversationRecord } from '../storage/records.ts';
import type { Storage } from '../storage/repositories.ts';

export type MessageRequest = { contact: ContactRecord; conversation: ConversationRecord };

/** Pedidos com mensagem para ler, o mais recente primeiro. Quem pediu e não escreveu (ou foi desbloqueado) não aparece. */
export async function listRequests(storage: Storage): Promise<MessageRequest[]> {
	const found: MessageRequest[] = [];
	for (const contact of await storage.contacts.list()) {
		if (contact.state !== 'pedido') continue;
		const conversation = await storage.conversations.get(directConversationId(contact.publicKey));
		if (conversation) found.push({ contact, conversation });
	}
	return found.sort((a, b) => b.conversation.lastMessageAt - a.conversation.lastMessageAt);
}

export async function listBlocked(storage: Storage): Promise<ContactRecord[]> {
	return (await storage.contacts.list()).filter((c) => c.state === 'bloqueado');
}

/** Aceitar: vira contato, e a conversa passa a aparecer na lista, com links e áudio. */
export async function acceptRequest(storage: Storage, publicKey: string): Promise<void> {
	const contact = await storage.contacts.get(publicKey);
	if (!contact) await storage.contacts.put({ publicKey, state: 'aceito', dmRelays: [], addedAt: Date.now() });
	else if (contact.state === 'pedido') await storage.contacts.put({ ...contact, state: 'aceito' });
}

/**
 * Bloquear: a conversa some do aparelho (como "Excluir conversa") e o que chegar dessa chave é descartado, sem aviso.
 * Serve para contato, pedido e quem nunca escreveu. `discard` cancela envio de arquivo que ainda sobe.
 */
export async function blockContact(storage: Storage, publicKey: string, discard: (messageId: string) => Promise<void>) {
	const contact = await storage.contacts.get(publicKey);
	await storage.contacts.put({ dmRelays: [], addedAt: Date.now(), ...contact, publicKey, state: 'bloqueado' });
	await deleteConversation(storage, directConversationId(publicKey), discard);
}

/** Desbloquear: volta a poder escrever; se escrever, cai nos pedidos. As mensagens de antes não voltam. */
export async function unblockContact(storage: Storage, publicKey: string): Promise<void> {
	const contact = await storage.contacts.get(publicKey);
	if (contact?.state === 'bloqueado') await storage.contacts.put({ ...contact, state: 'pedido' });
}

export type GroupRequest = { conversation: ConversationRecord; by: ContactRecord | undefined };

/** Grupos para os quais alguém que não é contato me adicionou, o mais recente primeiro (RF-12, T7). */
export async function listGroupRequests(storage: Storage): Promise<GroupRequest[]> {
	const found: GroupRequest[] = [];
	for (const conversation of await storage.conversations.listByRecent()) {
		const request = conversation.group?.request;
		if (request?.state !== 'pedido' || !conversation.group?.amMember) continue;
		found.push({ conversation, by: request.by ? await storage.contacts.get(request.by) : undefined });
	}
	return found.sort((a, b) => b.conversation.lastMessageAt - a.conversation.lastMessageAt);
}

/** Aceitar o grupo: sai dos pedidos e passa à lista. Quem chama se apresenta aos membros (só agora, T7). */
export async function acceptGroupRequest(storage: Storage, conversationId: string): Promise<ConversationRecord | undefined> {
	const conversation = await storage.conversations.get(conversationId);
	if (conversation?.group?.request?.state !== 'pedido') return undefined;
	const { request: _, ...group } = conversation.group;
	const accepted = { ...conversation, group };
	await storage.conversations.put(accepted);
	return accepted;
}

/**
 * Bloquear o grupo: bloqueia quem me adicionou, apaga as mensagens daqui e descarta o que vier dele, sem aviso a
 * ninguém. O estado do grupo fica (como em "Excluir conversa"), para um aviso novo não o trazer de volta como pedido.
 */
export async function blockGroupRequest(storage: Storage, conversationId: string, discard: (messageId: string) => Promise<void>) {
	const conversation = await storage.conversations.get(conversationId);
	if (!conversation?.group?.request) return;
	const { by } = conversation.group.request;
	await storage.conversations.put({ ...conversation, group: { ...conversation.group, request: { state: 'recusado', by } } });
	await clearConversation(storage, conversationId, discard);
	if (by) await blockContact(storage, by, discard);
}
