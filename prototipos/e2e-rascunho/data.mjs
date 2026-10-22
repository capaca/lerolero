// Data presa no topo (etapa 2 de UX): ao rolar, uma etiqueta mostra o dia da mensagem lá em cima e some ao parar.
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
const floating = () => page.$eval('.floating-day', (e) => ({ text: e.textContent, visible: e.classList.contains('visible') }))
try {
  await page.goto(URL0)
  await page.waitForFunction(() => location.pathname.endsWith('/bem-vindo'))
  await clickText('Criar minha conta'); await page.waitForSelector('#nome'); await page.type('#nome', 'Maria'); await clickText('Continuar')
  await page.waitForSelector('#pin'); await page.type('#pin', PIN); await page.type('#pin2', PIN)
  await page.waitForFunction(() => document.body.innerText.includes('Sua frase de recuperação'), { timeout: 20000 })
  await page.goto(URL0 + 'conversa/' + other)
  await page.waitForSelector('textarea', { timeout: 20000 })
  const noon = (daysAgo) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(12, 0, 0, 0); return Math.floor(d / 1000) }
  const list = []
  for (const [daysAgo, name] of [[1, 'ontem'], [0, 'hoje']]) for (let i = 0; i < 40; i++) list.push([`${name}${i}`, `Mensagem ${i} de ${name}`, noon(daysAgo) - 3600 + i * 60])
  await inject(list)
  await page.type('textarea', 'Oi'); await page.click('button[aria-label="Enviar"]')
  await page.waitForFunction(() => document.querySelectorAll('.row').length >= 81)
  await wait(500)
  ok(!(await floating()).visible, 'ao abrir (no fim da conversa) a etiqueta não aparece')

  // rola até a mensagem 30 de ontem ficar no topo
  await page.evaluate(() => {
    const s = document.querySelector('.messages')
    const row = [...document.querySelectorAll('.row')].find((r) => r.textContent.includes('Mensagem 30 de ontem'))
    s.scrollTop += row.getBoundingClientRect().top - s.getBoundingClientRect().top
  })
  await wait(200)
  let f = await floating()
  ok(f.visible && f.text === 'Ontem', `rolando no meio de ontem: "${f.text}" visível=${f.visible}`)
  await page.screenshot({ path: OUT + '/data-rolando.png' })

  await page.evaluate(() => {
    const s = document.querySelector('.messages')
    const row = [...document.querySelectorAll('.row')].find((r) => r.textContent.includes('Mensagem 10 de hoje'))
    s.scrollTop += row.getBoundingClientRect().top - s.getBoundingClientRect().top
  })
  await wait(200)
  f = await floating()
  ok(f.visible && f.text === 'Hoje', `rolando em hoje: "${f.text}"`)
  await wait(1800)
  ok(!(await floating()).visible, 'some depois que a rolagem para')

  await page.evaluate(() => { const s = document.querySelector('.messages'); s.scrollTop = s.scrollHeight })
  await wait(200)
  ok(!(await floating()).visible, 'no fim da conversa não aparece')
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
  await page.evaluate(() => { const s = document.querySelector('.messages'); s.scrollTop -= 1500 })
  await wait(300)
  f = await floating()
  ok(f.visible && f.text === 'Ontem', `rolagem longa até o começo: "${f.text}"`)
  await page.screenshot({ path: OUT + '/data-escuro.png' })
} finally { await browser.close() }
process.exit(failed ? 1 : 0)
