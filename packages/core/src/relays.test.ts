import { describe, expect, it } from 'vitest';
import published from '../../../relays.json' with { type: 'json' };
import { loadRelayList, parseRelayList } from './relays.ts';

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

	it('aceita relay e Blossom sem TLS só no próprio aparelho (suíte e2e)', () => {
		const list = parseRelayList({ ...valid, dm: ['ws://127.0.0.1:7000'], blossom: ['http://localhost:7001'] });
		expect(list.dm).toEqual(['ws://127.0.0.1:7000']);
		expect(list.blossom).toEqual(['http://localhost:7001']);
	});

	it.each([
		['relay sem TLS fora do aparelho', { ...valid, dm: ['ws://a.example'] }, /"dm" só aceita wss/],
		['Blossom sem TLS fora do aparelho', { ...valid, blossom: ['http://d.example'] }, /"blossom" só aceita https/],
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

describe('loadRelayList', () => {
	const embedded = { ...valid, atualizado: '2026-10-22' };

	it('usa a lista baixada quando ela é mais nova', async () => {
		const list = await loadRelayList(embedded, async () => ({ ...valid, atualizado: '2026-11-01', dm: ['wss://novo.example'] }));
		expect(list.dm).toEqual(['wss://novo.example']);
	});

	it('mantém a embutida quando a baixada é mais antiga', async () => {
		const list = await loadRelayList(embedded, async () => ({ ...valid, atualizado: '2026-01-01', dm: ['wss://velho.example'] }));
		expect(list.atualizado).toBe('2026-10-22');
	});

	it('cai na embutida se a rede falhar ou a baixada vier quebrada', async () => {
		expect((await loadRelayList(embedded, () => Promise.reject(new Error('offline')))).atualizado).toBe('2026-10-22');
		expect((await loadRelayList(embedded, async () => ({ versao: 99 }))).atualizado).toBe('2026-10-22');
	});
});
