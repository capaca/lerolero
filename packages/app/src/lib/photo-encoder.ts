// Codificador de foto do app: desenha no canvas e gera JPEG (o core decide os limites, RNF-23/24 e RF-02).
// JPEG porque o Safari não codifica WebP no canvas; a orientação EXIF vale na hora de desenhar.
import { preparePhoto, prepareProfilePhoto, type PhotoEncoder } from '@lerolero/core';

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
	return new Promise((resolve, reject) =>
		canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Não foi possível ler a foto.'))), 'image/jpeg', quality)
	);
}

/** Lê e comprime a foto escolhida; devolve o arquivo, o tamanho e a prévia. */
export async function prepareFromFile(file: Blob) {
	const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
	try {
		const encode: PhotoEncoder = async (maxSide, quality) => {
			const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
			const width = Math.max(1, Math.round(bitmap.width * scale));
			const height = Math.max(1, Math.round(bitmap.height * scale));
			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const context = canvas.getContext('2d')!;
			// fundo branco: PNG com transparência viraria preto no JPEG
			context.fillStyle = '#fff';
			context.fillRect(0, 0, width, height);
			context.drawImage(bitmap, 0, 0, width, height);
			return { blob: await canvasBlob(canvas, quality), width, height };
		};
		return await preparePhoto(encode);
	} finally {
		bitmap.close();
	}
}

/** Foto de perfil (RF-02): o quadrado do meio da foto escolhida, pequeno, com a prévia para o cartão. */
export async function prepareProfileFromFile(file: Blob) {
	const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
	try {
		const crop = Math.min(bitmap.width, bitmap.height);
		const sx = (bitmap.width - crop) / 2;
		const sy = (bitmap.height - crop) / 2;
		const encode: PhotoEncoder = async (maxSide, quality) => {
			const side = Math.max(1, Math.min(maxSide, crop));
			const canvas = document.createElement('canvas');
			canvas.width = side;
			canvas.height = side;
			const context = canvas.getContext('2d')!;
			context.fillStyle = '#fff';
			context.fillRect(0, 0, side, side);
			context.drawImage(bitmap, sx, sy, crop, crop, 0, 0, side, side);
			return { blob: await canvasBlob(canvas, quality), width: side, height: side };
		};
		return await prepareProfilePhoto(encode);
	} finally {
		bitmap.close();
	}
}
