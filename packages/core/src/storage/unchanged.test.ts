import { describe, expect, it } from 'vitest';
import { applyChanges, keepUnchanged, keepUnchangedGroups, olderPage, sameRecord } from './unchanged.ts';

describe('reaproveitar o que não mudou (P17)', () => {
	it('compara campos e objetos de dentro pelo conteúdo', () => {
		expect(sameRecord({ id: 'a', receipts: { x: 'lida' } }, { id: 'a', receipts: { x: 'lida' } })).toBe(true);
		expect(sameRecord({ id: 'a', receipts: { x: 'entregue' } }, { id: 'a', receipts: { x: 'lida' } })).toBe(false);
		expect(sameRecord({ id: 'a' }, { id: 'a', starred: true })).toBe(false);
		expect(sameRecord({ id: 'a', starred: undefined }, { id: 'a', deleted: undefined })).toBe(false);
		expect(sameRecord({ id: 'a', text: 'oi' }, { id: 'a', text: 'olá' })).toBe(false);
	});

	it('devolve os objetos antigos no lugar dos iguais e os novos onde algo mudou', () => {
		const a = { id: 'a', text: 'oi' };
		const b = { id: 'b', text: 'tudo bem?' };
		const next = keepUnchanged([a, b], [{ id: 'a', text: 'oi' }, { id: 'b', text: 'tudo bem? (editada)' }, { id: 'c', text: 'novo' }]);
		expect(next[0]).toBe(a);
		expect(next[1]).not.toBe(b);
		expect(next.map((x) => x.text)).toEqual(['oi', 'tudo bem? (editada)', 'novo']);
	});

	it('mantém a lista de reações de uma mensagem enquanto ela não muda', () => {
		const de1 = [{ id: 'r1', emoji: '👍' }];
		const de2 = [{ id: 'r2', emoji: '❤️' }];
		const next = keepUnchangedGroups(
			new Map([
				['m1', de1],
				['m2', de2]
			]),
			new Map([
				['m1', [{ id: 'r1', emoji: '👍' }]],
				['m2', [{ id: 'r2', emoji: '❤️' }, { id: 'r3', emoji: '😂' }]]
			])
		);
		expect(next.get('m1')).toBe(de1);
		expect(next.get('m2')).toHaveLength(2);
	});
});

describe('aplicar só as mensagens que mudaram (P17)', () => {
	const msg = (id: string, createdAt: number, text = id, conversationId = 'direta:x') => ({ id, conversationId, createdAt, text });
	const janela = [msg('a', 10), msg('b', 20), msg('c', 30)];

	it('a nova entra na ordem do banco, a mudada fica no lugar e a apagada sai', () => {
		const { list, older } = applyChanges(
			janela,
			[
				['d', msg('d', 25)],
				['e', msg('e', 30)],
				['b', msg('b', 20, 'editada')],
				['a', undefined]
			],
			'direta:x',
			10
		);
		expect(list.map((x) => x.id)).toEqual(['b', 'd', 'c', 'e']);
		expect(list[0].text).toBe('editada');
		expect(list[2]).toBe(janela[2]);
		expect(older).toBe(false);
	});

	it('no empate de horário vale o id, como no índice do banco', () => {
		const { list } = applyChanges([msg('a', 5), msg('m', 10)], [['z', msg('z', 10)], ['b', msg('b', 10)]], 'direta:x', 10);
		expect(list.map((x) => x.id)).toEqual(['a', 'b', 'm', 'z']);
	});

	it('a mais antiga que a janela não entra, mas avisa que há anteriores; a de outra conversa não entra', () => {
		const { list, older } = applyChanges(janela, [['velha', msg('velha', 5)], ['outra', msg('outra', 40, '', 'direta:y')]], 'direta:x', 10);
		expect(list.map((x) => x.id)).toEqual(['a', 'b', 'c']);
		expect(older).toBe(true);
	});

	it('passou do limite: as mais antigas saem da janela', () => {
		const { list, older } = applyChanges(janela, [['d', msg('d', 40)]], 'direta:x', 3);
		expect(list.map((x) => x.id)).toEqual(['b', 'c', 'd']);
		expect(older).toBe(true);
	});
});

describe('carregar anteriores em páginas (RNF-14)', () => {
	const msg = (id: string, createdAt: number) => ({ id, createdAt });

	it('pega as mais próximas da primeira da tela, sem ela nem as do mesmo segundo que vêm depois', () => {
		const primeira = msg('m', 50);
		const lidas = [msg('a', 10), msg('b', 20), msg('c', 30), msg('d', 50), msg('m', 50), msg('z', 50)];
		expect(olderPage(lidas, primeira, 2)).toEqual({ page: [msg('c', 30), msg('d', 50)], more: true });
		expect(olderPage(lidas, primeira, 4)).toEqual({ page: [msg('a', 10), msg('b', 20), msg('c', 30), msg('d', 50)], more: false });
	});
});
