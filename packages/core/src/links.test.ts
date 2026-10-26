import { describe, expect, it } from 'vitest';
import { splitLinks } from './links.ts';

const links = (text: string) => splitLinks(text).filter((p) => 'href' in p);

describe('endereços nas mensagens (T18)', () => {
	it('texto sem endereço fica como está', () => {
		expect(splitLinks('oi, tudo bem?')).toEqual([{ text: 'oi, tudo bem?' }]);
		expect(splitLinks('')).toEqual([]);
	});

	it('http, https e www viram link, e o resto do texto não se perde', () => {
		const parts = splitLinks('veja https://exemplo.com.br/a e http://b.org ou www.c.com.br fim');
		expect(parts.map((p) => ('href' in p ? p.href : p.text))).toEqual([
			'veja ',
			'https://exemplo.com.br/a',
			' e ',
			'http://b.org/',
			' ou ',
			'https://www.c.com.br/',
			' fim'
		]);
	});

	it('pontuação e parêntese de fora da frase não entram no link', () => {
		expect(links('olhe https://a.com/x.')[0]).toMatchObject({ href: 'https://a.com/x' });
		expect(links('(veja https://a.com/x)')[0]).toMatchObject({ href: 'https://a.com/x' });
		expect(links('"https://a.com/x", disse')[0]).toMatchObject({ href: 'https://a.com/x' });
		expect(splitLinks('https://a.com/x!').at(-1)).toEqual({ text: '!' });
		// parêntese que abre dentro do endereço fica (Wikipédia)
		expect(links('https://pt.wikipedia.org/wiki/Foo_(bar)')[0]).toMatchObject({ href: 'https://pt.wikipedia.org/wiki/Foo_(bar)' });
	});

	it('outros esquemas, endereço com usuário e domínio sem ponto continuam texto', () => {
		for (const text of ['javascript:alert(1)', 'data:text/html,x', 'ftp://a.com', 'https://banco.com@outro.com/x', 'http://localhost:3000', 'https://']) {
			expect(links(text)).toEqual([]);
			expect(splitLinks(text).map((p) => p.text).join('')).toBe(text);
		}
	});

	it('mostra o domínio inteiro e encurta só o resto', () => {
		const long = `https://exemplo.com.br/${'a'.repeat(200)}`;
		const [link] = links(long) as Array<{ text: string; href: string; host: string }>;
		expect(link.host).toBe('exemplo.com.br');
		expect(link.href).toBe(long);
		expect(link.text.startsWith('exemplo.com.br/aaa')).toBe(true);
		expect(link.text.length).toBeLessThanOrEqual(51);
		expect(link.text.endsWith('…')).toBe(true);
		expect(links('https://exemplo.com.br/')[0]).toMatchObject({ text: 'exemplo.com.br' });
	});

	it('domínio com letras parecidas aparece em punycode, que denuncia o golpe', () => {
		expect(links('https://bаnco.com')[0]).toMatchObject({ host: expect.stringMatching(/^xn--.*\.com$/) }); // "а" cirílico
	});
});
