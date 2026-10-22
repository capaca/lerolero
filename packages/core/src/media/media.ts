// Mídia de ponta a ponta: cifra, envia, guarda no aparelho e recupera (docs/06 §3.6).

import type { Storage } from '../storage/repositories.ts';
import type { MediaRecord } from '../storage/records.ts';
import { download, upload, type BlossomSigner } from './blossom.ts';
import { decryptFile, encryptFile, sha256 } from './crypto.ts';

/** O que vai na mensagem (kind 15) para quem recebe achar e abrir o arquivo. */
export type MediaRef = Pick<MediaRecord, 'ox' | 'x' | 'type' | 'size' | 'urls' | 'key' | 'nonce'>;

const refOf = (m: MediaRecord): MediaRef => ({ ox: m.ox, x: m.x, type: m.type, size: m.size, urls: m.urls, key: m.key, nonce: m.nonce });

/**
 * Prepara um arquivo para enviar. Se o mesmo arquivo (mesmo `ox`) já foi enviado ou
 * recebido, reaproveita o que está no servidor: encaminhar não reenvia (RF-70).
 */
export async function prepareMedia(
	storage: Storage,
	file: Blob,
	options: { servers: string[]; signer: BlossomSigner; now?: number }
): Promise<MediaRef> {
	const data = new Uint8Array(await file.arrayBuffer());
	const ox = await sha256(data);
	const now = options.now ?? Date.now();
	const known = await storage.media.get(ox);
	if (known?.urls.length) {
		await storage.media.put({ ...known, file: known.file ?? file, lastAccess: now });
		return refOf(known);
	}
	const enc = await encryptFile(data);
	const urls = await upload(options.servers, enc.encrypted, enc.x, options.signer);
	const record: MediaRecord = {
		ox,
		type: file.type || 'application/octet-stream',
		size: enc.size,
		file,
		urls,
		x: enc.x,
		key: enc.key,
		nonce: enc.nonce,
		keep: false,
		lastAccess: now
	};
	await storage.media.put(record);
	return refOf(record);
}

/** Abre uma mídia recebida: do aparelho, se já baixada; senão baixa, confere, decifra e guarda. */
export async function openMedia(storage: Storage, ref: MediaRef, now = Date.now()): Promise<Blob> {
	const known = await storage.media.get(ref.ox);
	if (known?.file) {
		await storage.media.touch(ref.ox, now);
		return known.file;
	}
	const encrypted = await download(ref.urls, ref.x);
	const data = await decryptFile(encrypted, ref);
	const file = new Blob([data], { type: ref.type });
	await storage.media.put({ ...ref, file, keep: known?.keep ?? false, lastAccess: now });
	return file;
}
