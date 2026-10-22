import puppeteer from 'puppeteer-core'
import { decode } from '/Users/pedro/Git/chat-app/packages/core/node_modules/nostr-tools/lib/esm/nip19.js'
const BASE = 'http://localhost:4181/lerolero/'
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', defaultViewport: { width: 400, height: 900 } })
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('ERRO:', String(e)))
const click = (l) => page.evaluate((l) => [...document.querySelectorAll('a,button')].find((e) => e.textContent.trim().startsWith(l)).click(), l)
await page.goto(BASE); await page.waitForFunction(() => location.pathname.endsWith('/bem-vindo'))
await click('Criar minha conta'); await page.waitForSelector('#nome'); await page.type('#nome', 'Teste rede'); await click('Continuar')
await page.waitForSelector('#pin'); await page.type('#pin', '111111'); await page.type('#pin2', '111111'); await click('Criar conta')
await page.waitForFunction(() => document.body.innerText.includes('Guarde estas'), { timeout: 20000 })
await page.click('input[type=checkbox]'); await click('Continuar'); await page.waitForSelector('input[id^=palavra-]'); await click('Fazer depois')
await page.waitForFunction(() => document.body.innerText.includes('Olá'))
await click('Ajustes'); await page.waitForSelector('.key')
await page.waitForFunction(() => /Conectado agora a [1-9]/.test(document.body.innerText), { timeout: 20000 })
await new Promise((r) => setTimeout(r, 3000))
console.log((await page.evaluate(() => document.body.innerText)).match(/Conectado agora[\s\S]*/)[0].trim().replace(/\n+/g, ' | '))
const npub = await page.$eval('.key', (e) => e.textContent.trim())
const hex = decode(npub).data
// confere na rede: o kind 10050 desta conta está no purplepag.es?
const ws = new WebSocket('wss://purplepag.es')
await new Promise((r) => (ws.onopen = r))
const found = await new Promise((resolve) => {
  const events = []
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d[0] === 'EVENT') events.push(d[2]); if (d[0] === 'EOSE') resolve(events) }
  ws.send(JSON.stringify(['REQ', 'x', { kinds: [10050], authors: [hex] }]))
})
ws.close()
console.log(found.length ? '✓ kind 10050 publicado na rede: ' + found[0].tags.map((t) => t[1].replace('wss://', '')).join(', ') : '✗ 10050 não encontrado')
await browser.close()
