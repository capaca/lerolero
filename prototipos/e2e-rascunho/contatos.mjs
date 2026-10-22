import puppeteer from 'puppeteer-core'
const BASE = 'http://localhost:4181/lerolero/'
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', defaultViewport: { width: 400, height: 850 } })
const ok = (cond, msg) => console.log(cond ? '✓' : '✗', msg)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function device({ noNativeDetector = false } = {}) {
  const ctx = await browser.createBrowserContext()
  await ctx.overridePermissions('http://localhost:4181', ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write'])
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('  ERRO NA PÁGINA:', String(e)))
  await page.evaluateOnNewDocument((noNative) => {
    if (noNative) delete window.BarcodeDetector
    // câmera falsa: desenha o QR guardado em window.__QR_SVG num canvas e entrega como vídeo
    navigator.mediaDevices.getUserMedia = async () => {
      const c = document.createElement('canvas'); c.width = 640; c.height = 480
      const g = c.getContext('2d')
      const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(window.__QR_SVG)
      await img.decode()
      const draw = () => { g.fillStyle = '#888'; g.fillRect(0, 0, 640, 480); g.drawImage(img, 170, 90, 300, 300) }
      draw(); setInterval(draw, 100)
      return c.captureStream(10)
    }
  }, noNativeDetector)
  return page
}
const click = (page, label) => page.evaluate((l) => { const el = [...document.querySelectorAll('a,button')].find((e) => e.textContent.trim().startsWith(l)); if (!el) throw new Error('sem ' + l); el.click() }, label)
const text = (page) => page.evaluate(() => document.body.innerText)
async function signup(page, name, pin) {
  await page.goto(BASE)
  await page.waitForFunction(() => location.pathname.endsWith('/bem-vindo'))
  await click(page, 'Criar minha conta'); await page.waitForSelector('#nome'); await page.type('#nome', name); await click(page, 'Continuar')
  await page.waitForSelector('#pin'); await page.type('#pin', pin); await page.type('#pin2', pin); await click(page, 'Criar conta')
  await page.waitForFunction(() => document.body.innerText.includes('Guarde estas'), { timeout: 20000 })
  await page.click('input[type=checkbox]'); await click(page, 'Continuar'); await page.waitForSelector('input[id^=palavra-]')
  await click(page, 'Fazer depois'); await page.waitForFunction((n) => document.body.innerText.includes('Olá, ' + n), {}, name)
}

// ---------- Maria cria a conta e pega o próprio convite ----------
const maria = await device()
await signup(maria, 'Maria', '111111')
await click(maria, 'Convidar alguém'); await maria.waitForSelector('.qr svg')
await click(maria, 'Copiar link'); await wait(200)
const link = await maria.evaluate(() => navigator.clipboard.readText())
const qrSvg = await maria.$eval('.qr', (e) => e.innerHTML)
ok(link.startsWith(BASE + 'convite#npub1') && link.includes('&n=Maria'), `link do convite: ${link.slice(0, 60)}…`)

// ---------- João (sem conta) abre o link: cadastro e depois o convite ----------
const joao = await device()
await joao.goto(link)
await joao.waitForFunction(() => location.pathname.endsWith('/bem-vindo'))
await click(joao, 'Criar minha conta'); await joao.waitForSelector('#nome'); await joao.type('#nome', 'João'); await click(joao, 'Continuar')
await joao.waitForSelector('#pin'); await joao.type('#pin', '222222'); await joao.type('#pin2', '222222'); await click(joao, 'Criar conta')
await joao.waitForFunction(() => document.body.innerText.includes('Guarde estas'), { timeout: 20000 })
await joao.click('input[type=checkbox]'); await click(joao, 'Continuar'); await joao.waitForSelector('input[id^=palavra-]'); await click(joao, 'Fazer depois')
await joao.waitForFunction(() => location.pathname.endsWith('/convite'), { timeout: 10000 })
ok((await text(joao)).includes('Se apresenta como: Maria'), 'convite aberto antes da conta é retomado depois do cadastro')
await joao.$eval('#nome', (e) => (e.value = ''))
await joao.type('#nome', 'Maria do trabalho')
await click(joao, 'Adicionar')
await joao.waitForFunction(() => location.pathname.includes('/contatos/'))
ok((await text(joao)).includes('Maria do trabalho') && (await text(joao)).includes('Se apresenta como “Maria”'), 'adicionada com o nome local; o nome escolhido aparece à parte')

// ---------- renomear ----------
await joao.$eval('#nome', (e) => (e.value = ''))
await joao.type('#nome', 'Maria Souza'); await click(joao, 'Salvar nome'); await wait(300)
await click(joao, '← Contatos'); await joao.waitForSelector('.list')
ok((await text(joao)).includes('Maria Souza'), 'renomear muda o nome na lista (RF-14)')

// ---------- Maria abre o próprio convite ----------
await maria.goto(link); await maria.waitForSelector('#pin')
await maria.type('#pin', '111111'); await click(maria, 'Entrar')
await maria.waitForFunction(() => location.pathname.endsWith('/convite'), { timeout: 10000 })
await wait(300)
ok((await text(maria)).includes('seu próprio convite'), 'o próprio convite é recusado com explicação (convite pendente retomado após o PIN)')

// ---------- João lê o QR da Maria (leitor nativo) e da Ana (jsQR) ----------
await joao.evaluate((svg) => (window.__QR_SVG = svg), qrSvg)
await click(joao, 'Adicionar contato'); await joao.waitForSelector('video')
await click(joao, 'Abrir a câmera')
await joao.waitForFunction(() => location.pathname.endsWith('/convite'), { timeout: 15000 })
await wait(300)
ok((await text(joao)).includes('já está nos seus contatos como Maria Souza'), 'QR lido pela câmera (leitor nativo): reconhece contato existente')

const ana = await device()
await signup(ana, 'Ana', '333333')
await click(ana, 'Convidar alguém'); await ana.waitForSelector('.qr svg')
const anaSvg = await ana.$eval('.qr', (e) => e.innerHTML)
const pedro = await device({ noNativeDetector: true })
await signup(pedro, 'Pedro', '444444')
console.log('  leitor nativo disponível no Pedro?', await pedro.evaluate(() => 'BarcodeDetector' in window))
await pedro.evaluate((svg) => (window.__QR_SVG = svg), anaSvg)
await click(pedro, 'Ver contatos'); await pedro.waitForFunction(() => location.pathname.endsWith('/contatos')); await click(pedro, 'Adicionar contato'); await pedro.waitForSelector('video')
await click(pedro, 'Abrir a câmera')
await pedro.waitForFunction(() => location.pathname.endsWith('/convite'), { timeout: 15000 })
await wait(300)
ok((await text(pedro)).includes('Se apresenta como: Ana'), 'QR lido pela câmera com o jsQR (sem leitor nativo)')

// ---------- colar npub de outro app e lixo ----------
await click(pedro, '← Contatos'); await pedro.waitForFunction(() => location.pathname.endsWith('/contatos')); await click(pedro, 'Adicionar contato'); await pedro.waitForSelector('#link')
await pedro.type('#link', 'qualquer coisa'); await click(pedro, 'Abrir convite'); await wait(300)
ok((await text(pedro)).includes('não parece ser um convite'), 'texto que não é convite → erro claro')
await pedro.$eval('#link', (e) => (e.value = ''))
await click(maria, '← Contatos'); await maria.waitForFunction(() => location.pathname.endsWith('/contatos')); await click(maria, 'Meu convite'); await maria.waitForSelector('.qr svg')
const mariaNpub = (await maria.evaluate(() => navigator.clipboard.readText())).match(/npub1[0-9a-z]+/)[0]
await pedro.type('#link', 'nostr:' + mariaNpub); await click(pedro, 'Abrir convite')
await pedro.waitForFunction(() => location.pathname.endsWith('/convite'), { timeout: 5000 })
await new Promise((r) => setTimeout(r, 300))
ok((await text(pedro)).includes('Se apresenta como: (sem nome)'), 'npub colado de outro app Nostr (sem nome) também abre o convite')
await browser.close()
