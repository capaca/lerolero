// Cifra de mídia (ADR-0004): cada arquivo ganha uma chave AES-GCM aleatória própria,
// que viaja só dentro da mensagem cifrada. O servidor guarda bytes que não consegue ler.

type Bytes = Uint8Array<ArrayBuffer>;

export const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

export function fromHex(hex: string): Bytes {
	if (!/^([0-9a-f]{2})*$/.test(hex)) throw new Error('hex inválido');
	const out = new Uint8Array(hex.length / 2);
	for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	return out;
}

export async function sha256(data: Bytes): Promise<string> {
	return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', data)));
}

export type EncryptedFile = {
	encrypted: Bytes;
	/** SHA-256 do original e do cifrado */
	ox: string;
	x: string;
	key: string;
	nonce: string;
	size: number;
};

export async function encryptFile(data: Bytes): Promise<EncryptedFile> {
	const rawKey = crypto.getRandomValues(new Uint8Array(32));
	const nonce = crypto.getRandomValues(new Uint8Array(12));
	const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt']);
	const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, data));
	return {
		encrypted,
		ox: await sha256(data),
		x: await sha256(encrypted),
		key: toHex(rawKey),
		nonce: toHex(nonce),
		size: data.length
	};
}

export class MediaIntegrityError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'MediaIntegrityError';
	}
}

/** Decifra conferindo os dois hashes: o servidor não consegue trocar o arquivo sem ser notado. */
export async function decryptFile(encrypted: Bytes, ref: { x: string; ox: string; key: string; nonce: string }): Promise<Bytes> {
	if ((await sha256(encrypted)) !== ref.x) throw new MediaIntegrityError('o arquivo baixado não é o enviado');
	const key = await crypto.subtle.importKey('raw', fromHex(ref.key), 'AES-GCM', false, ['decrypt']);
	let data: Bytes;
	try {
		data = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromHex(ref.nonce) }, key, encrypted));
	} catch {
		throw new MediaIntegrityError('não foi possível decifrar o arquivo');
	}
	if ((await sha256(data)) !== ref.ox) throw new MediaIntegrityError('o arquivo decifrado não confere');
	return data;
}
