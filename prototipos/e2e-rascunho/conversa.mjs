import puppeteer from 'puppeteer-core'
const BASE = 'http://localhost:4181/lerolero/'
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', defaultViewport: { width: 400, height: 800 } })
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

// João escreve (leva uns segundos para digitar, como uma pessoa)
await wait(3000)
const t0 = Date.now()
await joao.page.type('textarea', 'Oi Maria! Aqui é o João.')
await joao.page.evaluate(() => document.querySelector('button[aria-label="Enviar"]').click())
await joao.page.waitForFunction(() => document.body.innerText.includes('Oi Maria! Aqui é o João.'))
ok(Date.now() - t0 < 1000, `a mensagem aparece na hora para quem envia (${Date.now() - t0} ms)`)
await joao.page.waitForFunction(() => !!document.querySelector('.status svg[aria-label="enviada"]'), { timeout: 15000 })
console.log(`  ✓ "enviada" em ${Date.now() - t0} ms`)

// Maria recebe na tela inicial (sem recarregar)
await maria.page.goto(BASE); await maria.page.waitForSelector('#pin'); await maria.page.type('#pin', '111111'); await maria.click('Entrar')
await maria.page.waitForFunction(() => document.body.innerText.includes('Oi Maria'), { timeout: 20000 })
const home = await maria.text()
ok(home.includes('João') && home.includes('Oi Maria! Aqui é o João.'), 'Maria vê a conversa com o nome "João" (veio na mensagem cifrada) e a prévia')
ok((await maria.page.$eval('.badge', (e) => e.textContent).catch(() => '')) === '1', 'com 1 não lida')

// Maria abre: zera não lidas, vê aviso de "não é contato", responde
await maria.page.evaluate(() => document.querySelector('.conversations a').click())
await maria.page.waitForSelector('textarea'); await wait(500)
ok((await maria.text()).includes('não está nos seus contatos'), 'aviso: João ainda não é contato da Maria')
await wait(3000)
await maria.page.type('textarea', 'Oi João, tudo bem?')
const t1 = Date.now()
await maria.page.evaluate(() => document.querySelector('button[aria-label="Enviar"]').click())
await maria.page.waitForFunction(() => !!document.querySelector('.row.mine .status svg[aria-label="enviada"]'), { timeout: 15000 })
console.log(`  ✓ resposta da Maria "enviada" em ${Date.now() - t1} ms`)
await joao.page.waitForFunction(() => document.body.innerText.includes('Oi João, tudo bem?'), { timeout: 20000 })
ok(true, 'João recebe a resposta com a conversa aberta, sem recarregar')

// volta para o início da Maria: sem não lidas
await maria.page.evaluate(() => document.querySelector('header a').click())
await maria.page.waitForFunction(() => document.body.innerText.includes('Conversas')); await wait(500)
ok(!(await maria.page.$('.badge')), 'depois de ler, a conversa da Maria não tem não lidas')

// Maria adiciona João pelo aviso
await maria.page.evaluate(() => document.querySelector('.conversations a').click()); await maria.page.waitForSelector('textarea')
await maria.click('Adicionar aos contatos'); await maria.page.waitForSelector('#nome')
ok((await maria.page.$eval('#nome', (e) => e.value)) === 'João', 'adicionar pelo aviso sugere o nome recebido')
await maria.click('Adicionar'); await maria.page.waitForFunction(() => location.pathname.includes('/contatos/'))

await maria.page.waitForFunction(() => document.body.innerText.includes('João')); await new Promise((r) => setTimeout(r, 300))
await maria.page.evaluate(() => [...document.querySelectorAll('a')].find((a) => a.textContent.includes('Contatos')).click())
await maria.page.waitForFunction(() => location.pathname.endsWith('/contatos')); await new Promise((r) => setTimeout(r, 300))
ok((await maria.text()).includes('João'), 'João agora aparece na lista de contatos da Maria')
await joao.page.screenshot({ path: '/private/tmp/claude-503/-Users-pedro-Dev-Git-chat-app/f3f7f028-7727-4f69-87dc-156623f42179/scratchpad/conversa.png' })
await browser.close()
