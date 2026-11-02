import { describe, expect, it } from 'vitest';
import { cleanFileName, FILE_MAX_BYTES, isBlockedFile, saveName } from './file.ts';
import { mediaFromRumor, mediaTags } from '../conversations/messaging.ts';

const pdf = { type: 'application/pdf', size: 1000 };

describe('arquivos (RF-44, T22)', () => {
	it('tira do nome o que escapa da pasta ou esconde a extensão', () => {
		expect(cleanFileName('../../etc/passwd')).toBe('_.._etc_passwd');
		expect(cleanFileName('foto‮gpj.exe')).toBe('fotogpj.exe');
		expect(cleanFileName('nota.exe. . ')).toBe('nota.exe');
		expect(cleanFileName('   ')).toBeUndefined();
		expect(cleanFileName(`${'a'.repeat(300)}.pdf`)).toHaveLength(120);
		expect(cleanFileName(`${'a'.repeat(300)}.pdf`)?.endsWith('.pdf')).toBe(true);
	});

	it('bloqueia pela extensão, pelo tipo e pelo tamanho, mesmo disfarçado', () => {
		expect(isBlockedFile({ name: 'nota.pdf', ...pdf })).toBe(false);
		expect(isBlockedFile({ name: 'nota.pdf.EXE', ...pdf })).toBe(true);
		expect(isBlockedFile({ name: 'nota.exe.', ...pdf })).toBe(true);
		expect(isBlockedFile({ name: 'app.apk', type: 'image/png', size: 10 })).toBe(true);
		expect(isBlockedFile({ name: 'nota.pdf', type: 'text/html', size: 10 })).toBe(true);
		expect(isBlockedFile({ type: 'application/vnd.android.package-archive', size: 10 })).toBe(true);
		expect(isBlockedFile({ name: 'nota.pdf', type: 'application/pdf', size: FILE_MAX_BYTES + 1 })).toBe(true);
		// foto e áudio não têm nome
		expect(isBlockedFile({ type: 'image/jpeg', size: 200_000 })).toBe(false);
		expect(isBlockedFile({ type: 'audio/ogg', size: 200_000 })).toBe(false);
	});

	it('nome ao salvar: o da mensagem ou um feito do hash', () => {
		expect(saveName({ name: 'nota.pdf', type: 'application/pdf', ox: 'ab'.repeat(32) })).toBe('nota.pdf');
		expect(saveName({ type: 'image/jpeg', ox: 'ab'.repeat(32) })).toBe('lerolero-abababab.jpg');
	});

	it('o nome vai na tag e volta limpo de quem recebe', () => {
		const media = { ox: 'a'.repeat(64), x: 'b'.repeat(64), type: 'application/pdf', size: 10, urls: ['https://x.test/1'], key: 'c'.repeat(64), nonce: 'd'.repeat(24) };
		const rumor = (name: string) => ({ content: media.urls[0], tags: mediaTags({ ...media, name }) }) as Parameters<typeof mediaFromRumor>[0];
		expect(mediaFromRumor(rumor('nota.pdf'))?.name).toBe('nota.pdf');
		expect(mediaFromRumor(rumor('a/b‮.exe'))?.name).toBe('a_b.exe');
	});
});
