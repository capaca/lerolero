// Regressão do bug do teclado (2026-10-22): numa conversa com poucas mensagens, abrir o teclado
// empurrava a tela e as mensagens saíam de vista. O headless não abre teclado; com
// interactive-widget=resizes-content o teclado encolhe a página, então encolher a janela simula o mesmo.
import puppeteer from 'puppeteer-core'

const URL0 = 'http://localhost:4181/lerolero/'
const PIN = '123456'
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  defaultViewport: { width: 400, height: 850 }
})
let failed = 0
const ok = (c, m) => (console.log(c ? '✓' : '✗', m), c || failed++)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const page = await (await browser.createBrowserContext()).newPage()
page.on('pageerror', (e) => console.log('ERRO NA PÁGINA:', String(e)))
const clickText = (label) =>
  page.evaluate((label) => {
    const el = [...document.querySelectorAll('a,button')].find((e) => e.textContent.trim().startsWith(label))
    if (!el) throw new Error('não achei: ' + label)
    el.click()
  }, label)

// a última mensagem aparece inteira, logo acima do campo
const lastMessage = () =>
  page.evaluate(() => {
    const rows = document.querySelectorAll('.row')
    const last = rows[rows.length - 1].getBoundingClientRect()
    const box = document.querySelector('.messages').getBoundingClientRect()
    const composer = document.querySelector('.composer').getBoundingClientRect()
    return { visible: last.top >= box.top && last.bottom <= box.bottom, gap: Math.round(composer.top - last.bottom) }
  })

async function send(text) {
  await page.type('textarea', text)
  await page.click('button[aria-label="Enviar"]')
  await page.waitForFunction((t) => [...document.querySelectorAll('.row')].some((r) => r.textContent.includes(t)), {}, text)
}

try {
  const viewport = await page.goto(URL0).then(() => page.$eval('meta[name=viewport]', (m) => m.content))
  ok(viewport.includes('interactive-widget=resizes-content'), 'o teclado encolhe a página (meta viewport)')

  await page.waitForFunction(() => location.pathname.endsWith('/bem-vindo'))
  await clickText('Criar minha conta')
  await page.waitForSelector('#nome')
  await page.type('#nome', 'Maria')
  await clickText('Continuar')
  await page.waitForSelector('#pin')
  await page.type('#pin', PIN)
  await page.type('#pin2', PIN)
  await clickText('Criar conta')
  await page.waitForFunction(() => document.body.innerText.includes('Sua frase de recuperação'), { timeout: 20000 })

  // conversa com alguém qualquer: as mensagens aparecem na hora, mesmo sem entrega
  await page.goto(URL0 + 'conversa/' + 'ab'.repeat(32))
  await page.waitForSelector('textarea', { timeout: 20000 })
  for (const t of ['Oi', 'Tudo bem?', 'Chegou?']) await send(t)
  await wait(300)
  let m = await lastMessage()
  ok(m.visible && m.gap < 30, `poucas mensagens ficam junto do campo (folga ${m.gap}px)`)

  await page.focus('textarea')
  await page.setViewport({ width: 400, height: 450 })
  await wait(300)
  m = await lastMessage()
  ok(m.visible && m.gap < 30, `com o teclado aberto, a última continua à vista (folga ${m.gap}px)`)

  await page.setViewport({ width: 400, height: 850 })
  for (let i = 1; i <= 25; i++) await send(`Mensagem ${i}`)
  await wait(300)
  await page.setViewport({ width: 400, height: 450 })
  await wait(300)
  m = await lastMessage()
  ok(m.visible && m.gap < 30, `com muitas mensagens e o teclado aberto, continua no fim (folga ${m.gap}px)`)
} finally {
  await browser.close()
}
process.exit(failed ? 1 : 0)
