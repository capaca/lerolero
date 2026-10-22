// Cenários de atualização com o cache de 10 min do GitHub Pages
import puppeteer from 'puppeteer-core'
import { execSync } from 'node:child_process'
const S = process.env.S
const [from, to, then] = process.argv.slice(2)
const swap = (dir) => execSync(`rm -rf ${S}/site-live && cp -R ${S}/${dir} ${S}/site-live`)
const BASE = 'http://localhost:4183/lerolero/'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', userDataDir: `${S}/perfil-${from}-${to}`, defaultViewport: { width: 400, height: 800 } })
let page = await browser.newPage()
let errors = []
const watch = (p) => { p.on('pageerror', (e) => errors.push(String(e).slice(0, 110))); p.on('console', (m) => m.type() === 'error' && m.text().includes('dynamically') && errors.push(m.text().slice(0, 110))) }
watch(page)
const click = (l) => page.evaluate((l) => [...document.querySelectorAll('a,button')].find((e) => e.textContent.trim().startsWith(l)).click(), l)
const screen = async () => (await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 50))) || '(VAZIA)'
swap(from)
await page.goto(BASE); await page.waitForFunction(() => location.pathname.endsWith('/bem-vindo'))
await click('Criar minha conta'); await page.waitForSelector('#nome'); await page.type('#nome', 'Pedro'); await click('Continuar')
await page.waitForSelector('#pin'); await page.type('#pin', '111111'); await page.type('#pin2', '111111'); await click('Criar conta')
await page.waitForFunction(() => document.body.innerText.includes('Guarde estas'), { timeout: 20000 })
await page.click('input[type=checkbox]'); await click('Continuar'); await page.waitForSelector('input[id^=palavra-]'); await click('Fazer depois')
await page.waitForFunction(() => document.body.innerText.includes('Olá'))
// visita as páginas, como no uso normal (enchem o cache HTTP do navegador)
for (const p of ['desbloquear', 'contatos', 'ajustes', '']) { await page.goto(BASE + p); await wait(500) }
await page.waitForFunction(async () => (await navigator.serviceWorker.ready).active?.state === 'activated')
console.log(`[${from}] com conta: ${await screen()}`)

swap(to)
console.log(`--- publicada ${to}`)
const before = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).active.scriptURL + '|' + (await caches.keys()).join(','))
await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()))
await page.waitForFunction(async (b) => (await caches.keys()).join(',') !== b.split('|')[1] && (await caches.keys()).length === 1, { timeout: 30000 }, before).catch(() => console.log('  (o service worker novo não assumiu em 30 s)'))
console.log('  caches:', before.split('|')[1], '→', await page.evaluate(async () => (await caches.keys()).join(',')))
errors = []
await page.goto(BASE); await wait(3500)
console.log(`[${to}] reabrir: ${await page.evaluate(() => location.pathname)} → ${await screen()}${errors.length ? '  ERROS: ' + errors[0] : ''}`)

if (then) {
  swap(then)
  console.log(`--- publicada ${then}`)
  for (let i = 1; i <= 3; i++) {
    errors = []
    await page.goto(BASE); await wait(4000)
    console.log(`[${then}] abertura ${i}: ${await page.evaluate(() => location.pathname)} → ${await screen()}${errors.length ? '  ERROS: ' + errors[0] : ''}`)
  }
}
await browser.close()
