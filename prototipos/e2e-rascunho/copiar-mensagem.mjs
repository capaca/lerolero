// "Copiar" no menu da mensagem e vibração curta ao abrir o menu (etapa 2 de UX).
import puppeteer from 'puppeteer-core'
const URL0 = 'http://localhost:4181/lerolero/'
const PIN = '123456'
const OUT = process.argv[2]
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', defaultViewport: { width: 400, height: 820 } })
let failed = 0
const ok = (c, m) => (console.log(c ? '✓' : '✗', m), c || failed++)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const ctx = await browser.createBrowserContext()
await ctx.overridePermissions('http://localhost:4181', ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write'])
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('ERRO NA PÁGINA:', String(e)))
// o Chrome do Mac não vibra: registra as chamadas
await page.evaluateOnNewDocument(() => { window.__vibrou = []; navigator.vibrate = (p) => (window.__vibrou.push(p), true) })
const clickText = (label) => page.evaluate((label) => [...document.querySelectorAll('a,button')].find((e) => e.textContent.trim().startsWith(label)).click(), label)
const items = () => page.$$eval('.item', (bs) => bs.map((b) => b.textContent.trim()))
try {
  await page.goto(URL0)
  await page.waitForFunction(() => location.pathname.endsWith('/bem-vindo'))
  await clickText('Criar minha conta'); await page.waitForSelector('#nome'); await page.type('#nome', 'Maria'); await clickText('Continuar')
  await page.waitForSelector('#pin'); await page.type('#pin', PIN); await page.type('#pin2', PIN)
  await page.waitForFunction(() => document.body.innerText.includes('Sua frase de recuperação'), { timeout: 20000 })
  await page.goto(URL0 + 'conversa/' + 'ab'.repeat(32))
  await page.waitForSelector('textarea', { timeout: 20000 })
  const text = 'Endereço: Rua das Flores, 123\nApto 45'
  await page.$eval('textarea', (t, v) => { t.value = v; t.dispatchEvent(new Event('input', { bubbles: true })) }, text)
  await page.click('button[aria-label="Enviar"]')
  await page.waitForSelector('.row .bubble')

  await page.click('.row .bubble', { button: 'right' })
  await page.waitForSelector('.item')
  ok((await items())[0] === 'Copiar', `"Copiar" é a primeira opção (${(await items()).join(', ')})`)
  ok((await page.evaluate(() => window.__vibrou)).length === 1, 'vibrou ao abrir o menu')
  await page.screenshot({ path: OUT + '/copiar-menu.png' })
  await clickText('Copiar')
  await wait(200)
  ok((await page.evaluate(() => navigator.clipboard.readText())) === text, 'copiou o texto inteiro, com a quebra de linha')
  ok(!(await page.$('.item')) && (await page.$eval('.copied', (e) => e.textContent)) === 'Mensagem copiada', 'menu fecha e aparece "Mensagem copiada"')
  await page.screenshot({ path: OUT + '/copiar-aviso.png' })
  await wait(2300)
  ok(!(await page.$('.copied')), 'o aviso some sozinho')

  // toque longo (celular) também abre o menu
  const box = await (await page.$('.row .bubble')).boundingBox()
  await page.mouse.move(box.x + 20, box.y + 15); await page.mouse.down(); await wait(700); await page.mouse.up()
  ok(!!(await page.$('.item')) && (await page.evaluate(() => window.__vibrou)).length === 2, 'toque longo abre o menu e vibra')
  await clickText('Apagar para mim'); await wait(300)
} finally { await browser.close() }
process.exit(failed ? 1 : 0)
