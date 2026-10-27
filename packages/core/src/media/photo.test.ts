import { describe, expect, it } from 'vitest';
import { PHOTO_MAX_BYTES, PHOTO_MAX_SIDE, preparePhoto, THUMB_MAX_BYTES, THUMB_SIDE, validThumb, type PhotoEncoder } from './photo.ts';

// codificador falso: o tamanho cai com o lado e com a qualidade, como num JPEG
const fake = (megabytes: number): { encode: PhotoEncoder; calls: Array<[number, number]> } => {
	const calls: Array<[number, number]> = [];
	return {
		calls,
		encode: async (side, quality) => {
			calls.push([side, quality]);
			const size = Math.round(megabytes * 1_000_000 * quality * (side / PHOTO_MAX_SIDE) ** 2);
			return { blob: new Blob([new Uint8Array(Math.max(size, 10))], { type: 'image/jpeg' }), width: side, height: Math.round(side * 0.75) };
		}
	};
};

describe('foto para enviar', () => {
	it('fica na primeira tentativa se já cabe no limite', async () => {
		const { encode, calls } = fake(0.2);
		const photo = await preparePhoto(encode);
		expect(photo.file.size).toBeLessThanOrEqual(PHOTO_MAX_BYTES);
		expect(calls.filter(([side]) => side === PHOTO_MAX_SIDE)).toHaveLength(1);
		expect(photo).toMatchObject({ width: PHOTO_MAX_SIDE, height: 1200 });
	});

	it('baixa a qualidade e depois o tamanho até caber em 200 KB', async () => {
		const { encode } = fake(0.4);
		const photo = await preparePhoto(encode);
		expect(photo.file.size).toBeLessThanOrEqual(PHOTO_MAX_BYTES);
		expect(photo.width).toBeLessThanOrEqual(PHOTO_MAX_SIDE);
	});

	it('se nada couber, manda a menor tentativa em vez de falhar', async () => {
		const { encode } = fake(50);
		const photo = await preparePhoto(encode);
		expect(photo.width).toBe(1024);
		expect(photo.file.size).toBeGreaterThan(PHOTO_MAX_BYTES);
	});

	it('a prévia é pequena, em base64 e aceita na leitura', async () => {
		const { encode, calls } = fake(0.2);
		const photo = await preparePhoto(encode);
		expect(calls.some(([side]) => side === THUMB_SIDE)).toBe(true);
		expect(atob(photo.thumb).length).toBeLessThanOrEqual(THUMB_MAX_BYTES);
		expect(validThumb(photo.thumb)).toBe(photo.thumb);
	});
});

describe('prévia vinda de fora', () => {
	it('só base64 curto', () => {
		expect(validThumb('/9j/4AAQ')).toBe('/9j/4AAQ');
		expect(validThumb(undefined)).toBeUndefined();
		expect(validThumb('data:image/jpeg;base64,AAA')).toBeUndefined();
		expect(validThumb('A'.repeat(8_001))).toBeUndefined();
	});
});
