// Simula o celular: app antigo com conta → publicação nova → reabrir
import puppeteer from 'puppeteer-core'
import { execSync } from 'node:child_process'
const S = process.env.S
const swap = (dir) => execSync(`rm -rf ${S}/site-live && cp -R ${S}/${dir} ${S}/site-live`)
swap('site-old')
const launch = () => puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', userDataDir: `${S}/perfil-celular`, defaultViewport: { width: 400, height: 800 } })
const watch = (page, tag) => {
  page.on('pageerror', (e) => console.log(`[${tag}] ERRO NA PÁGINA:`, String(e)))
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('favicon') && console.log(`[${tag}] console:`, m.text()))
  page.on('response', (r) => r.status() >= 400 && !r.url().includes('favicon') && console.log(`[${tag}] HTTP ${r.status()} ${r.url()}`))
}
const BASE = 'http://localhost:4182/lerolero/'
let browser = await launch()
let page = await browser.newPage(); watch(page, 'antiga')
const click = (l) => page.evaluate((l) => [...document.querySelectorAll('a,button')].find((e) => e.textContent.trim().startsWith(l)).click(), l)
await page.goto(BASE); await page.waitForFunction(() => location.pathname.endsWith('/bem-vindo'))
await click('Criar minha conta'); await page.waitForSelector('#nome'); await page.type('#nome', 'Pedro'); await click('Continuar')
await page.waitForSelector('#pin'); await page.type('#pin', '111111'); await page.type('#pin2', '111111'); await click('Criar conta')
await page.waitForFunction(() => document.body.innerText.includes('Guarde estas'), { timeout: 20000 })
await page.click('input[type=checkbox]'); await click('Continuar'); await page.waitForSelector('input[id^=palavra-]'); await click('Fazer depois')
await page.waitForFunction(() => document.body.innerText.includes('Olá'))
await page.waitForFunction(async () => (await navigator.serviceWorker.ready).active?.state === 'activated')
console.log('versão antiga aberta, com conta:', await page.evaluate(() => location.pathname))
// publicação nova
swap('site-new')
console.log('--- publicada a versão nova')
// A) app continua aberto e a pessoa volta para ele
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
await new Promise((r) => setTimeout(r, 5000))
console.log('[A] app aberto:', await page.evaluate(() => document.body.innerText.slice(0, 80).replace(/\n/g, ' | ')) || '(VAZIA)')
// B) reabrir o app (nova janela no mesmo perfil)
await page.close()
page = await browser.newPage(); watch(page, 'reaberto')
await page.goto(BASE); await new Promise((r) => setTimeout(r, 4000))
console.log('[B] reaberto:', await page.evaluate(() => location.pathname), '|', (await page.evaluate(() => document.body.innerText.slice(0, 80).replace(/\n/g, ' | '))) || '(TELA BRANCA)')
// C) mais uma vez
await page.reload(); await new Promise((r) => setTimeout(r, 4000))
console.log('[C] de novo:', await page.evaluate(() => location.pathname), '|', (await page.evaluate(() => document.body.innerText.slice(0, 80).replace(/\n/g, ' | '))) || '(TELA BRANCA)')
await browser.close()
