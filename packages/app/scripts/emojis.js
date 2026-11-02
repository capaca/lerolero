// Gera src/lib/emojis.json, a lista do seletor de emojis (RF-29), a partir do emojibase-data em português.
// Roda só no desenvolvimento (`node scripts/emojis.js`), e o resultado vai para o repositório: o app não depende do
// pacote. Decidido em 2026-11-02 (docs/07, item 19): sem tons de pele, sem os componentes e sem os emojis novos
// demais, que o Android antigo mostra como quadradinho.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Emoji 11.0 (2018) vem inteiro a partir do Android 9; no 8, o aparelho de referência (RNF-02), só os ~150 dele faltam
const MAX_VERSION = 11;
// as chaves dos grupos do emojibase; o 2 ("component") são peças soltas, como o tom de pele sozinho
const GROUPS = ['smileys', 'people', null, 'animals', 'food', 'travel', 'activities', 'objects', 'symbols', 'flags'];

const data = JSON.parse(readFileSync(require.resolve('emojibase-data/pt/data.json'), 'utf8'));

/** `[grupo, [[emoji, "nome;palavra;palavra"], ...]]`, na ordem do Unicode. */
const groups = GROUPS.map((key) => [key, []]);
for (const e of data.sort((a, b) => a.order - b.order)) {
	if (e.group === undefined || !GROUPS[e.group] || e.version > MAX_VERSION) continue;
	const words = [...new Set([e.label, ...(e.tags ?? [])])].join(';');
	groups[e.group][1].push([e.emoji, words]);
}

const out = groups.filter(([key]) => key);
writeFileSync(new URL('../src/lib/emojis.json', import.meta.url), JSON.stringify(out) + '\n');
console.log(out.map(([key, list]) => `${key}: ${list.length}`).join(', '));
