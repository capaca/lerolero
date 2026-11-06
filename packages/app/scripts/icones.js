// Gera static/icon-192.png e static/icon-512.png a partir de static/icon.svg, a fonte do ícone (item 26).
// Roda só no desenvolvimento (`node scripts/icones.js`), e os PNGs vão para o repositório. Desenha no Chrome
// instalado, pelo Playwright da suíte e2e, para não trazer outra ferramenta só para isso.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../e2e/package.json', import.meta.url));
const { chromium } = require('@playwright/test');

const svg = readFileSync(new URL('../static/icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch({ channel: 'chrome' });
for (const size of [192, 512]) {
	const page = await browser.newPage({ viewport: { width: size, height: size } });
	await page.setContent(`<style>*{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
	await page.screenshot({ path: new URL(`../static/icon-${size}.png`, import.meta.url).pathname });
	await page.close();
}
await browser.close();
