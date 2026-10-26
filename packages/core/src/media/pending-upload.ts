// Envio de mídia sem fazer a pessoa esperar: o balão aparece na hora, com o arquivo do aparelho, e o envio ao
// Blossom (cifrar, subir, mandar a mensagem) roda por trás, tentando de novo com espera crescente e aleatória.
// Passados alguns minutos desiste e o balão pede uma decisão (tentar de novo ou apagar), em vez de ficar
// "enviando" para sempre. O estado vai no registro da mensagem (`upload`) e numa lista nas configurações:
// nada de tabela nova no banco.

import { deleteForMe, storePendingMessage } from '../conversations/messaging.ts';
import type { Storage } from '../storage/repositories.ts';
import type { MessageMedia, MessageRecord } from '../storage/records.ts';
import { sha256 } from './crypto.ts';
import { prepareMedia, type MediaRef } from './media.ts';
import type { BlossomSigner } from './blossom.ts';

export const PENDING_UPLOAD_PREFIX = 'envio:';
const LIST_KEY = 'enviosPendentes';

/** Quanto tempo tenta antes de desistir: minutos, não horas (decidido pelo Pedro em 2026-10-26). */
export const UPLOAD_GIVE_UP_MS = 5 * 60_000;
const FIRST_DELAY_MS = 2_000;
const MAX_DELAY_MS = 60_000;

/**
 * Espera antes da tentativa seguinte: dobra a cada falha (2 s, 4 s, 8 s… até 60 s) e sorteia entre a metade e o
 * total, para vários aparelhos que perderam a rede juntos não voltarem ao mesmo tempo (jitter).
 */
export function uploadRetryDelay(attempts: number, random = Math.random): number {
	const ceiling = Math.min(FIRST_DELAY_MS * 2 ** Math.max(0, attempts - 1), MAX_DELAY_MS);
	return Math.round(ceiling / 2 + (random() * ceiling) / 2);
}

export async function listPendingUploads(storage: Storage): Promise<string[]> {
	return (await storage.settings.get<string[]>(LIST_KEY)) ?? [];
}

async function setPending(storage: Storage, id: string, pending: boolean) {
	const ids = (await listPendingUploads(storage)).filter((i) => i !== id);
	if (pending) ids.push(id);
	await storage.settings.set(LIST_KEY, ids);
}

/** Guarda o áudio no aparelho e o balão provisório "enviando"; o envio de verdade é `tryPendingUpload`. */
export async function startPendingAudio(
	storage: Storage,
	input: { conversationId: string; me: string; file: Blob; duration: number; start?: number; now?: number }
): Promise<MessageRecord> {
	const now = input.now ?? Date.now();
	const ox = await sha256(new Uint8Array(await input.file.arrayBuffer()));
	const type = input.file.type || 'application/octet-stream';
	const known = await storage.media.get(ox);
	// sem endereço ainda: `prepareMedia` não reaproveita e faz o envio inteiro; `file` deixa o balão tocável
	if (!known) {
		await storage.media.put({ ox, type, size: input.file.size, file: input.file, urls: [], x: '', key: '', nonce: '', keep: false, lastAccess: now });
	}
	const media: MessageMedia = { ox, x: '', type, size: input.file.size, urls: [], key: '', nonce: '', duration: input.duration, ...(input.start ? { start: input.start } : {}) };
	const message: MessageRecord = {
		id: `${PENDING_UPLOAD_PREFIX}${crypto.randomUUID()}`,
		conversationId: input.conversationId,
		sender: input.me,
		kind: 15,
		text: '',
		createdAt: Math.floor(now / 1000),
		status: 'pendente',
		media,
		upload: { startedAt: now, attempts: 0, nextAttemptAt: now }
	};
	await storePendingMessage(storage, message);
	await setPending(storage, message.id, true);
	return message;
}

export type UploadAttempt =
	| { state: 'enviado' | 'cancelado' }
	/** falhou; tenta de novo em `at` (ms) */
	| { state: 'depois'; at: number }
	| { state: 'desistiu' };

/**
 * Uma tentativa: sobe o arquivo e manda a mensagem de verdade por `send`, e só então troca o balão provisório.
 * Falha de qualquer parte vira nova tentativa com espera maior, até `UPLOAD_GIVE_UP_MS`.
 */
export async function tryPendingUpload(
	storage: Storage,
	id: string,
	deps: {
		servers: string[];
		signer: BlossomSigner;
		/** manda a mensagem de verdade (kind 15, pela fila de sempre) */
		send: (media: MediaRef & { duration?: number; start?: number }) => Promise<void>;
		now?: () => number;
		random?: () => number;
	}
): Promise<UploadAttempt> {
	const now = deps.now ?? Date.now;
	const message = await storage.messages.get(id);
	if (!message?.upload || message.upload.failed || !message.media) return { state: 'cancelado' };
	try {
		const file = (await storage.media.get(message.media.ox))?.file;
		if (!file) throw new Error('arquivo não está mais no aparelho');
		const ref = await prepareMedia(storage, file, { servers: deps.servers, signer: deps.signer, now: now() });
		await deps.send({ ...ref, duration: message.media.duration, start: message.media.start });
	} catch {
		const attempts = message.upload.attempts + 1;
		const at = now() + uploadRetryDelay(attempts, deps.random);
		if (at - message.upload.startedAt >= UPLOAD_GIVE_UP_MS) {
			await storage.messages.put({ ...message, upload: { ...message.upload, attempts, failed: true } });
			await setPending(storage, id, false);
			return { state: 'desistiu' };
		}
		await storage.messages.put({ ...message, upload: { ...message.upload, attempts, nextAttemptAt: at } });
		return { state: 'depois', at };
	}
	// a mensagem de verdade já está guardada e na fila: o provisório sai (o arquivo fica, quem usa é ela)
	await deleteForMe(storage, id);
	await setPending(storage, id, false);
	return { state: 'enviado' };
}

/** "Tentar de novo" depois de desistir: recomeça a contagem. */
export async function retryPendingUpload(storage: Storage, id: string, now = Date.now()): Promise<boolean> {
	const message = await storage.messages.get(id);
	if (!message?.upload?.failed) return false;
	await storage.messages.put({ ...message, upload: { startedAt: now, attempts: 0, nextAttemptAt: now } });
	await setPending(storage, id, true);
	return true;
}

/** Apagar o balão que não saiu (ou cancelar o envio em andamento). */
export async function discardPendingUpload(storage: Storage, id: string) {
	await deleteForMe(storage, id);
	await setPending(storage, id, false);
}
