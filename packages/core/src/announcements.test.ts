import { describe, expect, it } from 'vitest';
import { ANNOUNCEMENT_MAX_LENGTH, currentAnnouncement, parseAnnouncements, type Announcement } from './announcements.ts';

const aviso = (extra: Partial<Announcement> = {}): Announcement => ({
	id: 'a1',
	nivel: 'info',
	texto: 'Os relays estão lentos hoje.',
	ate: '2026-11-07T00:00:00Z',
	...extra
});

const NOW = Date.parse('2026-11-06T12:00:00Z');

describe('parseAnnouncements', () => {
	it('aceita o formato que o workflow avisos.yml grava', () => {
		expect(parseAnnouncements({ versao: 1, avisos: [aviso()] })).toEqual([aviso()]);
		expect(parseAnnouncements({ versao: 1, avisos: [] })).toEqual([]);
	});

	it('ignora o arquivo que não entende', () => {
		expect(parseAnnouncements(null)).toEqual([]);
		expect(parseAnnouncements('texto')).toEqual([]);
		expect(parseAnnouncements({ versao: 2, avisos: [aviso()] })).toEqual([]);
		expect(parseAnnouncements({ versao: 1, avisos: 'não' })).toEqual([]);
	});

	it('descarta só o aviso errado e mantém os outros', () => {
		const bons = [aviso(), aviso({ id: 'a2', nivel: 'problema' })];
		const ruins = [
			null,
			{ ...aviso(), id: '' },
			{ ...aviso(), nivel: 'urgente' },
			{ ...aviso(), texto: '   ' },
			{ ...aviso(), texto: 'x'.repeat(ANNOUNCEMENT_MAX_LENGTH + 1) },
			{ ...aviso(), ate: 'amanhã' },
			{ ...aviso(), texto: 42 }
		];
		expect(parseAnnouncements({ versao: 1, avisos: [...ruins, ...bons] })).toEqual(bons);
	});

	it('tira os espaços em volta do texto', () => {
		expect(parseAnnouncements({ versao: 1, avisos: [aviso({ texto: '  Oi \n' })] })[0].texto).toBe('Oi');
	});
});

describe('currentAnnouncement', () => {
	it('mostra o aviso dentro da validade', () => {
		expect(currentAnnouncement([aviso()], NOW, [])).toEqual(aviso());
	});

	it('some sozinho depois da validade', () => {
		expect(currentAnnouncement([aviso({ ate: '2026-11-06T11:59:59Z' })], NOW, [])).toBeUndefined();
	});

	it('o fechado neste aparelho não volta, mas um novo aparece', () => {
		expect(currentAnnouncement([aviso()], NOW, ['a1'])).toBeUndefined();
		expect(currentAnnouncement([aviso(), aviso({ id: 'a2' })], NOW, ['a1'])?.id).toBe('a2');
	});

	it('o de problema vem antes do de informação', () => {
		const list = [aviso(), aviso({ id: 'a2', nivel: 'problema' })];
		expect(currentAnnouncement(list, NOW, [])?.id).toBe('a2');
	});
});
