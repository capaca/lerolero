// Foto para enviar: comprimida no aparelho antes de subir (RF-41, RNF-23) e com uma prévia minúscula que
// viaja dentro da própria mensagem (RNF-24), para o balão aparecer antes de baixar a foto inteira.
// Quem desenha a imagem (canvas) é a interface; aqui só a conta de tamanho e qualidade, testável sem navegador.

/** Lado maior da foto enviada, em pixels (RNF-23). */
export const PHOTO_MAX_SIDE = 1600;
/** Tamanho que a foto enviada deve ter, em bytes (RNF-23). */
export const PHOTO_MAX_BYTES = 200_000;
/** Lado maior e tamanho da prévia (RNF-24). */
export const THUMB_SIDE = 48;
export const THUMB_MAX_BYTES = 5_000;

/** Desenha a foto original com o lado maior até `maxSide` e a codifica em JPEG na `quality` (0 a 1). */
export type PhotoEncoder = (maxSide: number, quality: number) => Promise<{ blob: Blob; width: number; height: number }>;

export type PreparedPhoto = { file: Blob; width: number; height: number; thumb: string };

// do mais caprichado ao mais leve: para no primeiro que cabe
const ATTEMPTS: Array<[side: number, quality: number]> = [
	[PHOTO_MAX_SIDE, 0.82],
	[PHOTO_MAX_SIDE, 0.7],
	[1280, 0.7],
	[1280, 0.55],
	[1024, 0.5]
];
const THUMB_QUALITIES = [0.6, 0.45, 0.3];

async function toBase64(blob: Blob): Promise<string> {
	let binary = '';
	for (const b of new Uint8Array(await blob.arrayBuffer())) binary += String.fromCharCode(b);
	return btoa(binary);
}

export async function preparePhoto(encode: PhotoEncoder): Promise<PreparedPhoto> {
	let best: Awaited<ReturnType<PhotoEncoder>> | undefined;
	for (const [side, quality] of ATTEMPTS) {
		const out = await encode(side, quality);
		if (!best || out.blob.size < best.blob.size) best = out;
		if (out.blob.size <= PHOTO_MAX_BYTES) break;
	}
	let thumb: Blob | undefined;
	for (const quality of THUMB_QUALITIES) {
		const out = await encode(THUMB_SIDE, quality);
		if (!thumb || out.blob.size < thumb.size) thumb = out.blob;
		if (out.blob.size <= THUMB_MAX_BYTES) break;
	}
	return { file: best!.blob, width: best!.width, height: best!.height, thumb: await toBase64(thumb!) };
}

/** Prévia que veio de fora é dado não confiável: só base64 e de tamanho pequeno (cabe uma prévia de ~6 KB). */
export function validThumb(value: string | undefined): string | undefined {
	return value && value.length <= 8_000 && /^[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : undefined;
}
