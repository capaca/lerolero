// Gera os ícones do Android (res/mipmap-*) a partir de app/static/icon.svg, a mesma fonte do PWA (item 26).
// Roda só no desenvolvimento (`node scripts/icones.js`), e os PNGs vão para o repositório. Desenha no Chrome
// instalado, pelo Playwright da suíte e2e, como o scripts/icones.js do app.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../e2e/package.json', import.meta.url));
const { chromium } = require('@playwright/test');

const svg = readFileSync(new URL('../../app/static/icon.svg', import.meta.url), 'utf8');
// o fundo do ícone adaptativo é a cor do primeiro retângulo; a frente é o desenho sem ele
const background = svg.match(/<rect width="512" height="512" fill="(#[0-9a-f]+)"\/>/i);
if (!background) throw new Error('icon.svg sem o retângulo de fundo');
const foreground = svg.replace(background[0], '');

const res = new URL('../android/app/src/main/res/', import.meta.url).pathname;
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
async function draw(path, size, body) {
	await page.setViewportSize({ width: size, height: size });
	await page.setContent(`<style>*{margin:0}html,body{background:transparent}</style>${body}`);
	await page.screenshot({ path, omitBackground: true });
}
for (const [name, scale] of Object.entries(densities)) {
	const dir = `${res}mipmap-${name}/`;
	const legacy = 48 * scale;
	await draw(`${dir}ic_launcher.png`, legacy, svg.replace('<svg ', `<svg width="${legacy}" height="${legacy}" `));
	await draw(
		`${dir}ic_launcher_round.png`,
		legacy,
		`<div style="width:${legacy}px;height:${legacy}px;border-radius:50%;overflow:hidden">${svg.replace('<svg ', `<svg width="${legacy}" height="${legacy}" `)}</div>`
	);
	// frente do adaptativo: tela de 108 dp; o balão cabe no círculo seguro de 66 dp com o desenho em 84 dp
	const canvas = 108 * scale;
	const art = 84 * scale;
	await draw(
		`${dir}ic_launcher_foreground.png`,
		canvas,
		`<div style="width:${canvas}px;height:${canvas}px;display:grid;place-items:center">${foreground.replace('<svg ', `<svg width="${art}" height="${art}" `)}</div>`
	);
}
await browser.close();
console.log(`fundo do ícone adaptativo: ${background[1]}`);
