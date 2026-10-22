// "Ir para o fim" e "Mensagens novas" (etapa 2 de UX). O histórico entra direto no IndexedDB;
// as mensagens que chegam com a conversa aberta vêm de outra pessoa pelos relays reais (pode levar >30 s).
// Também é regressão: duas mensagens seguidas para alguém novo saíam no mesmo segundo e chegavam trocadas.
import puppeteer from 'puppeteer-core'
const URL0 = 'http://localhost:4181/lerolero/'
const PIN = '123456'
const OUT = process.argv[2]
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', defaultViewport: { width: 400, height: 820 } })
let failed = 0
const ok = (c, m) => (console.log(c ? '✓' : '✗', m), c || failed++)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
async function person(name) {
  const page = await (await browser.createBrowserContext()).newPage()
  page.on('pageerror', (e) => console.log(`[${name}] ERRO NA PÁGINA:`, String(e)))
  const clickText = (label) => page.evaluate((label) => [...document.querySelectorAll('a,button')].find((e) => e.textContent.trim().startsWith(label)).click(), label)
  await page.goto(URL0)
  await page.waitForFunction(() => location.pathname.endsWith('/bem-vindo'))
  await clickText('Criar minha conta'); await page.waitForSelector('#nome'); await page.type('#nome', name); await clickText('Continuar')
  await page.waitForSelector('#pin'); await page.type('#pin', PIN); await page.type('#pin2', PIN)
  await page.waitForFunction(() => document.body.innerText.includes('Sua frase de recuperação'), { timeout: 20000 })
  const publicKey = await page.evaluate(() => new Promise((ok) => { indexedDB.open('lerolero').onsuccess = (e) => { e.target.result.transaction('identity').objectStore('identity').get('eu').onsuccess = (g) => ok(g.target.result.publicKey) } }))
  return { page, publicKey }
}
const put = (page, store, records) => page.evaluate((store, records) => new Promise((ok, fail) => {
  const req = indexedDB.open('lerolero')
  req.onerror = fail
  req.onsuccess = () => {
    const tx = req.result.transaction(store, 'readwrite')
    for (const r of records) tx.objectStore(store).put(r)
    tx.oncomplete = ok
  }
}), store, records)
const state = (page) => page.evaluate(() => {
  const s = document.querySelector('.messages'), box = s.getBoundingClientRect()
  const line = document.querySelector('.new-line'), next = line?.nextElementSibling
  return {
    atEnd: s.scrollHeight - s.scrollTop - s.clientHeight < 8,
    line: !!line, lineVisible: !!line && line.getBoundingClientRect().top >= box.top && line.getBoundingClientRect().bottom <= box.bottom,
    afterLine: next?.textContent.trim().replace(/\s*\d\d:\d\d.*$/, ''),
    button: !!document.querySelector('.jump'), badge: document.querySelector('.jump .badge')?.textContent ?? '',
    label: document.querySelector('.jump')?.getAttribute('aria-label')
  }
})
try {
  const maria = await person('Maria')
  const joao = await person('João')
  const cid = 'direta:' + joao.publicKey
  const now = Math.floor(Date.now() / 1000) - 3600
  const history = Array.from({ length: 60 }, (_, i) => ({ id: 'h' + i, conversationId: cid, sender: joao.publicKey, kind: 14, text: `Antiga ${i}`, createdAt: now + i * 30, status: 'recebida' }))
  await put(maria.page, 'messages', history)
  await put(maria.page, 'conversations', [{ id: cid, type: 'direta', members: [joao.publicKey], lastMessageAt: now + 59 * 30, unread: 5, lastMessagePreview: 'Antiga 59' }])

  await maria.page.goto(URL0 + 'conversa/' + joao.publicKey)
  await maria.page.waitForSelector('.row', { timeout: 20000 })
  await wait(500)
  let st = await state(maria.page)
  ok(st.line && st.afterLine === 'Antiga 55', `ao abrir, a linha fica antes da primeira não lida (${st.afterLine})`)
  ok(st.lineVisible && !st.button, 'com 5 não lidas, abre mostrando a linha e o fim, sem botão')

  await maria.page.evaluate(() => { document.querySelector('.messages').scrollTop = 0 })
  await wait(300)
  st = await state(maria.page)
  ok(st.button && !st.badge && st.label === 'Ir para o fim', 'lá em cima aparece o botão, sem número')

  // João manda duas com a Maria lendo lá em cima
  await joao.page.goto(URL0 + 'conversa/' + maria.publicKey)
  await joao.page.waitForSelector('textarea', { timeout: 20000 })
  for (const t of ['Novidade 1', 'Novidade 2']) {
    await joao.page.type('textarea', t); await joao.page.click('button[aria-label="Enviar"]'); await wait(300)
  }
  await maria.page.waitForFunction(() => document.querySelector('.jump .badge')?.textContent === '2', { timeout: 90000 })
  st = await state(maria.page)
  ok(st.badge === '2' && st.label === 'Ir para o fim, 2 mensagens novas', `o botão conta as que chegaram: ${st.badge}`)
  ok(st.afterLine === 'Novidade 1', `a linha passa para a primeira que chegou (${st.afterLine})`)
  ok(!st.atEnd, 'a tela não pulou para o fim enquanto ela lia')
  await maria.page.screenshot({ path: OUT + '/novas-botao.png' })

  const order = await maria.page.$$eval('.row', (rs) => rs.slice(-2).map((r) => r.textContent.trim().slice(0, 10)).join('|'))
  ok(order === 'Novidade 1|Novidade 2', `as duas chegam na ordem em que o João mandou (${order})`)
  await maria.page.click('.jump')
  await wait(500)
  st = await state(maria.page)
  ok(st.atEnd && !st.button, 'tocar no botão leva ao fim e o botão some')
  await maria.page.screenshot({ path: OUT + '/novas-fim.png' })
} finally { await browser.close() }
process.exit(failed ? 1 : 0)
