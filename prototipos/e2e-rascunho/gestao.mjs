// Gestão do grupo: detalhes, renomear, adicionar, promover, remover e sair (relays reais).
import puppeteer from 'puppeteer-core'

const URL0 = 'http://localhost:4181/lerolero/'
const OUT = new URL('.', import.meta.url).pathname
const PIN = '123456'
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  defaultViewport: { width: 400, height: 850 }
})
const step = (s) => console.log('✓', s)
const check = (cond, s) => { if (!cond) throw new Error('✗ ' + s); step(s) }
const LONG = { timeout: 90000 }
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function newPerson(name) {
  const ctx = await browser.createBrowserContext()
  await ctx.overridePermissions('http://localhost:4181', ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write'])
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log(`[${name}] ERRO NA PÁGINA:`, String(e)))
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && console.log(`[${name}] console:`, m.text()))
  return page
}
const clickText = (page, label, scope = 'a,button') =>
  page.evaluate((label, scope) => {
    const el = [...document.querySelectorAll(scope)].find((e) => e.textContent.trim().startsWith(label))
    if (!el) throw new Error('não achei: ' + label)
    el.click()
  }, label, scope)
const text = (page) => page.evaluate(() => document.body.innerText)
const has = (page, s) => page.waitForFunction((s) => document.body.innerText.includes(s), LONG, s)
const atHome = (page) =>
  page.waitForFunction(() => location.pathname.endsWith('/lerolero/') && document.querySelector('[aria-label="Nova conversa"]'), { timeout: 20000 })

async function createAccount(page, name) {
  await page.goto(URL0)
  await page.waitForFunction(() => location.pathname.endsWith('/bem-vindo'))
  await clickText(page, 'Criar minha conta')
  await page.waitForSelector('#nome')
  await page.type('#nome', name)
  await clickText(page, 'Continuar')
  await page.waitForSelector('#pin')
  await page.type('#pin', PIN)
  await page.type('#pin2', PIN)
  await page.waitForFunction(() => document.body.innerText.includes('Sua frase de recuperação'), { timeout: 20000 })
  await page.goto(URL0)
  await atHome(page)
}
async function inviteLink(page) {
  await page.goto(URL0 + 'contatos/meu-convite')
  await page.waitForSelector('.qr svg', { timeout: 20000 })
  await clickText(page, 'Copiar link')
  await wait(300)
  return page.evaluate(() => navigator.clipboard.readText())
}
async function addFromLink(page, link) {
  await page.goto(link)
  await page.waitForSelector('#nome', { timeout: 20000 })
  await clickText(page, 'Adicionar')
  await page.waitForFunction(() => location.pathname.includes('/contatos/'), { timeout: 20000 })
}
async function openGroup(page, name) {
  await page.goto(URL0)
  await atHome(page)
  await page.waitForFunction((n) => document.body.innerText.includes(n), LONG, name)
  await page.evaluate((n) => [...document.querySelectorAll('.conversations a')].find((a) => a.textContent.includes(n)).click(), name)
  await page.waitForFunction(() => location.pathname.includes('/grupo/') && document.querySelector('textarea, .closed'), LONG)
}
async function openDetails(page) {
  await page.evaluate(() => document.querySelector('header a.who').click())
  await page.waitForFunction(() => location.pathname.endsWith('/detalhes') && document.querySelector('.list'), { timeout: 20000 }).catch(async (e) => {
    console.log('  caminho:', await page.evaluate(() => location.pathname), '\n  texto:', (await text(page)).slice(0, 300))
    await page.screenshot({ path: OUT + 'falha.png' })
    throw e
  })
}
/** papéis na lista: "Você:Criador|Bia:|Caio:" */
const roster = (page) =>
  page.$$eval('.list li button.row', (rows) => rows.map((r) => `${r.querySelector('.text').textContent}:${r.querySelector('.role')?.textContent ?? ''}`).join('|'))
async function memberMenu(page, name) {
  await page.evaluate((n) => [...document.querySelectorAll('.list button.row')].find((b) => b.textContent.includes(n)).click(), name)
  await page.waitForSelector('.sheet')
  return page.$$eval('.sheet .item', (items) => items.map((i) => i.textContent.trim()).join('|'))
}

try {
  const [ana, bia, caio, davi] = await Promise.all(['Ana', 'Bia', 'Caio', 'Davi'].map(newPerson))
  for (const [p, n] of [[ana, 'Ana'], [bia, 'Bia'], [caio, 'Caio'], [davi, 'Davi']]) await createAccount(p, n)
  for (const p of [bia, caio, davi]) await addFromLink(ana, await inviteLink(p))
  step('quatro contas; Ana tem Bia, Caio e Davi nos contatos')

  await ana.goto(URL0 + 'grupo/novo')
  await ana.waitForSelector('.person', { timeout: 20000 })
  await ana.type('#nome', 'Amigos')
  await ana.evaluate(() => [...document.querySelectorAll('.person')].filter((b) => !b.textContent.includes('Davi')).forEach((b) => b.click()))
  await clickText(ana, 'Criar grupo')
  await ana.waitForFunction(() => location.pathname.includes('/grupo/') && document.querySelector('textarea'), { timeout: 20000 })
  step('Ana criou "Amigos" com Bia e Caio')

  // detalhes ao tocar no nome
  await openDetails(ana)
  let t = await text(ana)
  check(t.includes('Grupo · 3 pessoas') && t.includes('Adicionar pessoas') && !!(await ana.$('[aria-label="Mudar o nome do grupo"]')), 'tocar no nome abre os detalhes: 3 pessoas, adicionar e lápis para a criadora')
  check((await roster(ana)) === 'Você:Criador|Bia:|Caio:', 'lista: Você (Criador) primeiro, depois Bia e Caio')

  // renomear
  await ana.click('[aria-label="Mudar o nome do grupo"]')
  await ana.waitForSelector('.rename #nome')
  await ana.$eval('.rename #nome', (e) => (e.value = ''))
  await ana.type('.rename #nome', 'Amigos de sempre')
  await clickText(ana, 'Salvar')
  await has(ana, 'Amigos de sempre')
  step('renomeado para "Amigos de sempre"')

  // adicionar Davi
  await clickText(ana, 'Adicionar pessoas')
  await ana.waitForFunction(() => location.pathname.endsWith('/adicionar') && document.querySelector('.person, .hint'), { timeout: 20000 })
  t = await text(ana)
  check(t.includes('Davi') && !t.includes('Bia') && t.includes('Cabem mais 17 pessoas'), 'adicionar mostra só quem não está no grupo (Davi) e quantos cabem')
  await ana.click('.person')
  await clickText(ana, 'Adicionar')
  await ana.waitForFunction(() => location.pathname.endsWith('/detalhes') && document.body.innerText.includes('Grupo · 4 pessoas'), { timeout: 20000 })
  step('Davi adicionado: 4 pessoas')

  // promover Bia
  check((await memberMenu(ana, 'Bia')) === 'Conversar|Tornar administrador|Remover do grupo|Cancelar', 'menu da Bia para a criadora: conversar, tornar administrador, remover')
  await ana.screenshot({ path: OUT + 'gestao-menu.png' })
  await clickText(ana, 'Tornar administrador', '.sheet .item')
  await ana.waitForFunction(() => document.body.innerText.includes('Administrador'), { timeout: 20000 })
  await clickText(ana, 'Conversa')
  await ana.waitForSelector('textarea')
  await has(ana, 'Você deu a Bia a função de administrador')
  t = await ana.$$eval('.notice-line', (n) => n.map((x) => x.textContent).join('\n'))
  console.log('  avisos na Ana:\n   ' + t.replaceAll('\n', '\n   '))
  await ana.screenshot({ path: OUT + 'gestao-conversa.png' })

  // Caio, membro comum: vê tudo, não mexe em nada
  await openGroup(caio, 'Amigos de sempre')
  await caio.waitForFunction(() => document.body.innerText.includes('administrador'), LONG)
  await openDetails(caio)
  await caio.waitForFunction(() => document.body.innerText.includes('4 pessoas'), LONG)
  t = await text(caio)
  check(!t.includes('Adicionar pessoas') && !(await caio.$('[aria-label="Mudar o nome do grupo"]')) && t.includes('Sair do grupo'), 'Caio (membro comum): sem adicionar nem lápis, com "Sair do grupo"')
  check((await memberMenu(caio, 'Bia')) === 'Conversar|Cancelar', 'menu de outro membro para o Caio: só conversar')
  await clickText(caio, 'Cancelar', '.sheet .item')

  // Bia, administradora: remove Caio, não mexe em Ana
  await openGroup(bia, 'Amigos de sempre')
  await bia.waitForFunction(() => document.body.innerText.includes('administrador'), LONG)
  await openDetails(bia)
  await bia.waitForFunction(() => document.body.innerText.includes('4 pessoas'), LONG)
  check((await roster(bia)).startsWith('Você:Administrador|~Ana:Criador'), 'Bia se vê como Administrador; Ana aparece como ~Ana, Criador')
  check((await memberMenu(bia, 'Ana')) === 'Conversar|Cancelar', 'Bia não pode remover nem rebaixar a criadora')
  await clickText(bia, 'Cancelar', '.sheet .item')
  check((await memberMenu(bia, 'Caio')) === 'Conversar|Tornar administrador|Remover do grupo|Cancelar', 'Bia pode promover ou remover o Caio')
  await clickText(bia, 'Remover do grupo', '.sheet .item')
  await has(bia, 'Remover ~Caio do grupo?')
  await bia.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
  await bia.screenshot({ path: OUT + 'gestao-remover-escuro.png' })
  await bia.emulateMediaFeatures([])
  await clickText(bia, 'Remover', '.sheet button')
  await bia.waitForFunction(() => document.body.innerText.includes('Grupo · 3 pessoas'), { timeout: 20000 })
  step('Bia removeu o Caio')

  // Caio fica sabendo
  await caio.waitForFunction(() => document.body.innerText.includes('Você não faz mais parte deste grupo'), LONG)
  t = await text(caio)
  check(!t.includes('Sair do grupo'), 'Caio vê o aviso de que não faz mais parte, sem "Sair do grupo"')

  // Ana sai: o título vai para Bia
  await openDetails(ana)
  await clickText(ana, 'Sair do grupo')
  await has(ana, 'Bia passa a ser o criador')
  step('ao sair, Ana é avisada de que Bia passa a ser a criadora')
  await clickText(ana, 'Sair do grupo', '.sheet button')
  await ana.waitForFunction(() => !location.pathname.endsWith('/detalhes') && document.body.innerText.includes('Você não faz mais parte deste grupo'), { timeout: 20000 })
  step('Ana saiu: a conversa fica sem campo de envio')

  await bia.waitForFunction(() => document.querySelector('.list .role')?.textContent === 'Criador', LONG)
  check((await roster(bia)).startsWith('Você:Criador'), 'Bia agora é a criadora')
  await bia.screenshot({ path: OUT + 'gestao-bia.png' })
} catch (e) {
  for (const p of browser.browserContexts().flatMap(() => [])) void p
  for (const ctx of browser.browserContexts()) for (const pg of await ctx.pages()) console.log('--- tela', await pg.evaluate(() => location.pathname + '\n' + document.body.innerText.slice(0, 600)))
  throw e
} finally {
  await browser.close()
}
