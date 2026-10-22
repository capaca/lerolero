// Balões agrupados (etapa 2 de UX): sequência da mesma pessoa com pontinha só no último.
// Também é regressão da ordem: mensagens mandadas no mesmo segundo apareciam trocadas (2026-10-22).
// As mensagens do contato entram direto no IndexedDB, sem rede.
import puppeteer from 'puppeteer-core'
const URL0 = 'http://localhost:4181/lerolero/'
const PIN = '123456'
const OUT = process.argv[2]
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', defaultViewport: { width: 400, height: 820 } })
let failed = 0
const ok = (c, m) => (console.log(c ? '✓' : '✗', m), c || failed++)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const page = await (await browser.createBrowserContext()).newPage()
page.on('pageerror', (e) => console.log('ERRO NA PÁGINA:', String(e)))
const clickText = (label) => page.evaluate((label) => [...document.querySelectorAll('a,button')].find((e) => e.textContent.trim().startsWith(label)).click(), label)
async function send(text) {
  await page.type('textarea', text)
  await page.click('button[aria-label="Enviar"]')
  await page.waitForFunction((t) => [...document.querySelectorAll('.row')].some((r) => r.textContent.includes(t)), {}, text)
}
const other = 'ab'.repeat(32)
const inject = (list) => page.evaluate((list, other) => new Promise((ok, fail) => {
  const req = indexedDB.open('lerolero')
  req.onerror = fail
  req.onsuccess = () => {
    const tx = req.result.transaction('messages', 'readwrite')
    for (const [id, text, createdAt] of list) tx.objectStore('messages').put({ id, conversationId: 'direta:' + other, sender: other, kind: 14, text, createdAt, status: 'recebida' })
    tx.oncomplete = ok
  }
}), list, other)
try {
  await page.goto(URL0)
  await page.waitForFunction(() => location.pathname.endsWith('/bem-vindo'))
  await clickText('Criar minha conta'); await page.waitForSelector('#nome'); await page.type('#nome', 'Maria'); await clickText('Continuar')
  await page.waitForSelector('#pin'); await page.type('#pin', PIN); await page.type('#pin2', PIN)
  await page.waitForFunction(() => document.body.innerText.includes('Sua frase de recuperação'), { timeout: 20000 })
  await page.goto(URL0 + 'conversa/' + other)
  await page.waitForSelector('textarea', { timeout: 20000 })
  const now = Math.floor(Date.now() / 1000)
  await inject([['r1', 'Oi Maria!', now - 300], ['r2', 'Tudo bem por aí?', now - 290], ['r3', 'Tô chegando, devo levar alguma coisa? Pensei em levar um bolo de fubá.', now - 280]])
  for (const t of ['Oi!', 'Tudo ótimo', 'Pode trazer o bolo sim, todo mundo adora']) await send(t)
  await inject([['r4', 'Combinado 👍', now + 60]])
  await send('Até já')
  await wait(400)
  const rows = await page.$$eval('.row', (rs) => rs.map((r) => ({ t: r.textContent.trim().slice(0, 12), first: r.classList.contains('first'), last: r.classList.contains('last'), tail: !!r.querySelector('.tail') })))
  const pattern = rows.map((r) => (r.first ? 'F' : '-') + (r.last ? 'L' : '-')).join(' ')
  ok(rows.map((r) => r.t.slice(0, 4)).join('|') === 'Oi M|Tudo|Tô c|Oi! |Tudo|Pode|Até |Comb', 'mensagens na ordem em que foram enviadas')
  ok(pattern === 'F- -- -L F- -- -- -L FL', `começo e fim das sequências: ${pattern}`)
  ok(rows.every((r) => r.tail === r.last), 'pontinha só no último de cada sequência')
  await page.screenshot({ path: OUT + '/baloes-claro.png' })
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
  await page.screenshot({ path: OUT + '/baloes-escuro.png' })
} finally { await browser.close() }
process.exit(failed ? 1 : 0)
