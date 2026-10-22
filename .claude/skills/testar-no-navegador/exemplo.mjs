// Ponto de partida: cria uma conta e recarrega a página. Copie para o diretório de teste e escreva os passos novos no fim.
import puppeteer from 'puppeteer-core'

const URL0 = 'http://localhost:4181/lerolero/'
const PIN = '123456'
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  defaultViewport: { width: 400, height: 850 },
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
})
const step = (s) => console.log('✓', s)

async function newPerson() {
  const page = await (await browser.createBrowserContext()).newPage()
  page.on('pageerror', (e) => console.log('ERRO NA PÁGINA:', String(e)))
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && console.log('console:', m.text()))
  return page
}
const clickText = (page, label) =>
  page.evaluate((label) => {
    const el = [...document.querySelectorAll('a,button')].find((e) => e.textContent.trim().startsWith(label))
    if (!el) throw new Error('não achei: ' + label)
    el.click()
  }, label)
const type = async (page, sel, value) => {
  await page.$eval(sel, (e) => { e.value = '' })
  await page.type(sel, value)
}
const atHome = (page) =>
  page.waitForFunction(() => location.pathname.endsWith('/lerolero/') && document.querySelector('[aria-label="Nova conversa"]'), { timeout: 20000 })
const atPin = (page) => page.waitForFunction(() => location.pathname.endsWith('/desbloquear'), { timeout: 20000 })

/** Cria a conta e para na tela da frase (a frase não é conferida: o lembrete fica no início). */
async function createAccount(page, name) {
  await page.goto(URL0)
  await page.waitForFunction(() => location.pathname.endsWith('/bem-vindo'))
  await clickText(page, 'Criar minha conta')
  await page.waitForSelector('#nome')
  await type(page, '#nome', name)
  await clickText(page, 'Continuar')
  await page.waitForSelector('#pin')
  await type(page, '#pin', PIN)
  await type(page, '#pin2', PIN)
  await page.waitForFunction(() => document.body.innerText.includes('Sua frase de recuperação'), { timeout: 20000 })
  return page.$$eval('ol li', (lis) => lis.map((li) => li.textContent.replace(/^\d+/, '').trim()))
}

/** Edita um registro de settings no IndexedDB (ex.: voltar o relógio de uma sessão). */
const editSetting = (page, key, fn) =>
  page.evaluate(
    (key, fnSource) =>
      new Promise((ok, fail) => {
        const req = indexedDB.open('lerolero')
        req.onerror = fail
        req.onsuccess = () => {
          const store = req.result.transaction('settings', 'readwrite').objectStore('settings')
          const get = store.get(key)
          get.onsuccess = () => {
            const record = get.result
            record.value = new Function('v', `return (${fnSource})(v)`)(record.value)
            store.put(record).onsuccess = () => ok()
          }
        }
      }),
    key,
    fn.toString()
  )

try {
  const maria = await newPerson()
  await createAccount(maria, 'Maria')
  await maria.goto(URL0)
  await atHome(maria)
  step('conta criada e no início')

  // exemplo: sessão aberta há 6 minutos → recarregar pede o PIN
  await editSetting(maria, 'sessaoAberta', (v) => ({ ...v, lastSeen: Date.now() - 6 * 60_000 }))
  await maria.reload()
  await atPin(maria)
  await maria.type('#pin', PIN)
  await atHome(maria)
  step('sessão vencida → PIN → início')

  // passos novos aqui
} finally {
  await browser.close()
}
