import { describe, expect, it } from 'vitest';
import published from '../../../relays.json' with { type: 'json' };
import { parseRelayList } from './relays.ts';

const valid = {
	versao: 1,
	atualizado: '2026-10-22',
	dm: ['wss://a.example', 'wss://b.example/'],
	geral: ['wss://c.example'],
	blossom: ['https://d.example']
};

describe('parseRelayList', () => {
	it('aceita a lista publicada em relays.json', () => {
		const list = parseRelayList(published);
		expect(list.dm.length).toBeGreaterThan(0);
		expect(list.blossom.length).toBeGreaterThan(0);
	});

	it('normaliza endereços e completa as reservas ausentes', () => {
		const list = parseRelayList(valid);
		expect(list.dm).toEqual(['wss://a.example', 'wss://b.example']);
		expect(list.dmReserva).toEqual([]);
		expect(list.blossomReserva).toEqual([]);
	});

	it('remove repetidos', () => {
		const list = parseRelayList({ ...valid, dm: ['wss://a.example', 'wss://A.example/'] });
		expect(list.dm).toEqual(['wss://a.example']);
	});

	it.each([
		['versão desconhecida', { ...valid, versao: 2 }, /versão/],
		['relay sem wss', { ...valid, dm: ['https://a.example'] }, /"dm" só aceita wss/],
		['Blossom sem https', { ...valid, blossom: ['wss://d.example'] }, /"blossom" só aceita https/],
		['endereço inválido', { ...valid, geral: ['não é url'] }, /endereço inválido/],
		['lista obrigatória vazia', { ...valid, blossom: [] }, /"blossom" está vazia/],
		['mais de 3 relays de DM', { ...valid, dm: ['wss://a.x', 'wss://b.x', 'wss://c.x', 'wss://d.x'] }, /mais de 3/],
		['não é objeto', 'texto', /não é um objeto/]
	])('recusa %s', (_, input, message) => {
		expect(() => parseRelayList(input)).toThrow(message);
	});
});
