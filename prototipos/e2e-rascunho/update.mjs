import puppeteer from 'puppeteer-core'
import { execSync } from 'node:child_process'
const BASE = 'http://localhost:4181/lerolero/'
const S = process.env.S
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' })
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('ERRO:', String(e)))
const version = () => page.evaluate(() => Object.entries(globalThis).find(([k]) => k.startsWith('__sveltekit_'))?.[1]?.version)
await page.goto(BASE + 'teste')
await page.waitForFunction(async () => (await navigator.serviceWorker.ready).active?.state === 'activated' && !!navigator.serviceWorker.controller, { timeout: 15000 })
const v1 = await version()
console.log('versão aberta:', v1)
// sai uma versão nova no servidor
execSync(`cd ${process.env.REPO} && BASE_PATH=/lerolero pnpm build >/dev/null 2>&1 && rm -rf ${S}/site/lerolero && cp -RL packages/app/build ${S}/site/lerolero`)
// a pessoa volta para o app (visibilitychange) → procura atualização
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
await page.waitForFunction(() => document.body.innerText.includes('Nova versão disponível'), { timeout: 20000 })
console.log('✓ aviso "Nova versão disponível" apareceu sem fechar o app')
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Atualizar')).click())
await page.waitForNavigation({ timeout: 10000 }).catch(() => {})
await new Promise((r) => setTimeout(r, 1000))
const v2 = await version()
console.log(v2 && v2 !== v1 ? `✓ depois de "Atualizar": versão nova (${v2})` : `✗ continua na versão ${v2}`)
console.log((await page.evaluate(() => document.body.innerText)).includes('Nova versão disponível') ? '✗ aviso continua' : '✓ aviso some depois de atualizar')
await browser.close()
