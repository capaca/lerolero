// Pseudolíngua para o teste de textos fixos (ADR-0008): uma cópia do projeto do inlang em .pseudo/, com cada
// texto de messages/pt-BR.json trocado por "[Ćŕîàŕ çôñţà···]": acentuado, entre colchetes e ~30% mais longo.
// Texto que aparece na tela sem os colchetes ficou fixo no código. Só para o build do teste
// (`pnpm build:pseudo`), nunca para o da produção.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const LETTERS = {
	a: 'à', b: 'ƀ', c: 'ç', d: 'ð', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'î', j: 'ĵ', k: 'ķ', l: 'ļ', m: 'ɱ',
	n: 'ñ', o: 'ô', p: 'þ', q: 'ǫ', r: 'ŕ', s: 'š', t: 'ţ', u: 'û', v: 'ṽ', w: 'ŵ', x: 'ẋ', y: 'ý', z: 'ž',
	A: 'À', B: 'Ɓ', C: 'Ç', D: 'Ð', E: 'É', F: 'Ƒ', G: 'Ĝ', H: 'Ĥ', I: 'Î', J: 'Ĵ', K: 'Ķ', L: 'Ļ', M: 'Ṁ',
	N: 'Ñ', O: 'Ô', P: 'Þ', Q: 'Ǫ', R: 'Ŕ', S: 'Š', T: 'Ţ', U: 'Û', V: 'Ṽ', W: 'Ŵ', X: 'Ẋ', Y: 'Ý', Z: 'Ž'
};

/** Troca as letras fora das variáveis ({nome}) e alonga o texto, para mostrar onde o layout quebra. */
function pseudo(text) {
	const accented = text
		.split(/(\{[^}]*\})/)
		.map((part) => (part.startsWith('{') ? part : [...part].map((ch) => LETTERS[ch] ?? ch).join('')))
		.join('');
	const visible = text.replace(/\{[^}]*\}/g, '').length;
	return `[${accented}${'·'.repeat(Math.ceil(visible * 0.3))}]`;
}

const transform = (value) =>
	typeof value === 'string'
		? pseudo(value)
		: value.map((variant) => ({
				...variant,
				match: Object.fromEntries(Object.entries(variant.match).map(([k, v]) => [k, pseudo(v)]))
			}));

const { $schema, ...messages } = JSON.parse(readFileSync('messages/pt-BR.json', 'utf8'));
const out = { $schema, ...Object.fromEntries(Object.entries(messages).map(([k, v]) => [k, transform(v)])) };

rmSync('.pseudo', { recursive: true, force: true });
mkdirSync('.pseudo/messages', { recursive: true });
mkdirSync('.pseudo/project.inlang', { recursive: true });
// mesma língua (pt-BR), para o resto do app (Intl, tipos) não mudar: só os textos são de mentira
writeFileSync('.pseudo/messages/pt-BR.json', JSON.stringify(out, null, '\t'));
const settings = JSON.parse(readFileSync('project.inlang/settings.json', 'utf8'));
settings.modules = settings.modules.map((m) => m.replace(/^\.\//, '../'));
writeFileSync('.pseudo/project.inlang/settings.json', JSON.stringify(settings, null, '\t'));
cpSync('project.inlang/paraglide.config.js', '.pseudo/project.inlang/paraglide.config.js');
