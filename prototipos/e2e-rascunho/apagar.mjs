import puppeteer from 'puppeteer-core'
const BASE = 'http://localhost:4181/lerolero/'
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'], defaultViewport: { width: 400, height: 800 } })
const ok = (c, m) => console.log(c ? '✓' : '✗', m)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
async function device(name, pin) {
  const ctx = await browser.createBrowserContext()
  await ctx.overridePermissions('http://localhost:4181', ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write'])
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log(`  [${name}] ERRO:`, String(e)))
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && console.log(`  [${name}] console:`, m.text()))
  await page.goto(BASE); await page.waitForFunction(() => location.pathname.endsWith('/bem-vindo'))
  const click = (l) => page.evaluate((l) => { const e = [...document.querySelectorAll('a,button')].find((e) => e.textContent.trim().startsWith(l)); if (!e) throw new Error('sem ' + l); e.click() }, l)
  await click('Criar minha conta'); await page.waitForSelector('#nome'); await page.type('#nome', name); await click('Continuar')
  await page.waitForSelector('#pin'); await page.type('#pin', pin); await page.type('#pin2', pin); await click('Criar conta')
  await page.waitForFunction(() => document.body.innerText.includes('Guarde estas'), { timeout: 20000 })
  await page.click('input[type=checkbox]'); await click('Continuar'); await page.waitForSelector('input[id^=palavra-]'); await click('Fazer depois')
  await page.waitForFunction((n) => document.body.innerText.includes('Olá, ' + n), {}, name)
  return { page, click, text: () => page.evaluate(() => document.body.innerText), path: () => page.evaluate(() => location.pathname) }
}

const maria = await device('Maria', '111111')
const joao = await device('João', '222222')

// Maria manda o convite; João adiciona
await maria.click('Convidar alguém'); await maria.page.waitForSelector('.qr svg'); await maria.click('Copiar link'); await wait(200)
const link = await maria.page.evaluate(() => navigator.clipboard.readText())
await joao.page.goto(link); await joao.page.waitForSelector('#pin'); await joao.page.type('#pin', '222222'); await joao.click('Entrar')
await joao.page.waitForFunction(() => location.pathname.endsWith('/convite'), { timeout: 10000 }); await joao.page.waitForSelector('#nome')
await joao.click('Adicionar'); await joao.page.waitForFunction(() => location.pathname.includes('/contatos/'))
await joao.click('Conversar'); await joao.page.waitForSelector('textarea')
ok((await joao.text()).includes('Nenhuma mensagem ainda'), 'conversa nova e vazia')

// João grava um áudio de ~3 s
await wait(2000)
console.log('  grava Opus?', await joao.page.evaluate(() => ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus'].find((t) => MediaRecorder.isTypeSupported(t))))
await joao.page.evaluate(() => document.querySelector('button[aria-label="Gravar áudio"]').click())
await joao.page.waitForFunction(() => document.body.innerText.includes('Gravando'))
await wait(3200)
const t0 = Date.now()
await joao.page.evaluate(() => document.querySelector('button[aria-label="Enviar áudio"]').click())
await joao.page.waitForFunction(() => document.querySelector('.player'), { timeout: 20000 })
console.log(`  ✓ áudio na conversa do João em ${Date.now() - t0} ms (gravar → cifrar → subir para 2 servidores)`)
await joao.page.waitForFunction(() => !!document.querySelector('.status svg[aria-label="enviada"]'), { timeout: 15000 })
ok(true, 'áudio "enviado" (✓)')

// João também manda um texto
await joao.page.type('textarea', 'mensagem que vou apagar')
await joao.page.evaluate(() => document.querySelector('button[aria-label="Enviar"]').click())
await joao.page.waitForFunction(() => document.querySelectorAll('.row.mine .status svg[aria-label="enviada"]').length === 2, { timeout: 15000 })

// Maria abre a conversa e vê as duas
await maria.page.goto(BASE); await maria.page.waitForSelector('#pin'); await maria.page.type('#pin', '111111'); await maria.click('Entrar')
await maria.page.waitForFunction(() => document.querySelector('.conversations a'), { timeout: 20000 })
await maria.page.evaluate(() => document.querySelector('.conversations a').click())
await maria.page.waitForFunction(() => document.body.innerText.includes('mensagem que vou apagar') && document.querySelector('.player'), { timeout: 20000 })
const audioUrl = await maria.page.evaluate(async () => { const d = await new Promise((r) => { const q = indexedDB.open('lerolero'); q.onsuccess = () => r(q.result) }); return new Promise((r) => { const t = d.transaction('messages').objectStore('messages').getAll(); t.onsuccess = () => r(t.result.find((m) => m.media)?.media.urls) }) })
console.log('  áudio está em:', audioUrl.map((u) => new URL(u).host).join(', '))

// João apaga o texto para todos (botão direito)
const bubbles = await joao.page.$$('.row.mine .bubble')
await bubbles[1].click({ button: 'right' })
await joao.page.waitForSelector('.sheet')
await joao.page.screenshot({ path: '/private/tmp/claude-503/-Users-pedro-Dev-Git-chat-app/f3f7f028-7727-4f69-87dc-156623f42179/scratchpad/menu.png' }); await joao.click('Apagar para todos'); await joao.page.waitForFunction(() => document.body.innerText.includes('Apagar para todos?')); await joao.page.screenshot({ path: '/private/tmp/claude-503/-Users-pedro-Dev-Git-chat-app/f3f7f028-7727-4f69-87dc-156623f42179/scratchpad/confirmar.png' })
await joao.page.evaluate(() => [...document.querySelectorAll('.sheet button')].find((b) => b.textContent.includes('Apagar para todos')).click())
await joao.page.waitForFunction(() => document.body.innerText.includes('Você apagou esta mensagem'))
ok(true, 'João vê "Você apagou esta mensagem"')
await maria.page.waitForFunction(() => document.body.innerText.includes('Esta mensagem foi apagada') && !document.body.innerText.includes('mensagem que vou apagar'), { timeout: 20000 })
await maria.page.screenshot({ path: '/private/tmp/claude-503/-Users-pedro-Dev-Git-chat-app/f3f7f028-7727-4f69-87dc-156623f42179/scratchpad/apagada.png' }); ok(true, 'Maria vê "Esta mensagem foi apagada" (sem recarregar)')

// João apaga o áudio para todos: some da Maria e dos servidores
await (await joao.page.$$('.row.mine .bubble'))[0].click({ button: 'right' })
await joao.page.waitForSelector('.sheet'); await joao.click('Apagar para todos')
await joao.page.evaluate(() => [...document.querySelectorAll('.sheet button')].find((b) => b.textContent.includes('Apagar para todos')).click())
await maria.page.waitForFunction(() => !document.querySelector('.player'), { timeout: 20000 })
ok(true, 'o áudio some da conversa da Maria')
await wait(3000)
const status = await Promise.all(audioUrl.map(async (u) => (await fetch(u)).status))
ok(status.every((s) => s === 404), `arquivo removido dos servidores Blossom (HTTP ${status.join(', ')})`)

// Maria apaga para ela a mensagem apagada? não aparece menu; apaga para mim uma nova
await joao.page.type('textarea', 'esta a Maria apaga só para ela')
await joao.page.evaluate(() => document.querySelector('button[aria-label="Enviar"]').click())
await maria.page.waitForFunction(() => document.body.innerText.includes('esta a Maria apaga só para ela'), { timeout: 20000 })
const last = (await maria.page.$$('.row .bubble')).at(-1)
await last.click({ button: 'right' }); await maria.page.waitForSelector('.sheet')
const options = await maria.page.$$eval('.sheet button', (bs) => bs.map((b) => b.textContent.trim()))
ok(!options.includes('Apagar para todos'), 'mensagem de outra pessoa: só "Apagar para mim"')
await maria.click('Apagar para mim')
await maria.page.waitForFunction(() => !document.body.innerText.includes('esta a Maria apaga só para ela'))
await wait(2000)
ok((await joao.text()).includes('esta a Maria apaga só para ela'), 'apagar para mim não afeta o João')
await browser.close()
