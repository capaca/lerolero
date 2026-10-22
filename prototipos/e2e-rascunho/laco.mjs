// Código faltando no servidor: a autocorreção tenta uma vez e não entra em laço
import puppeteer from 'puppeteer-core'
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' })
const page = await browser.newPage()
let loads = 0
page.on('load', () => loads++)
await page.goto('http://localhost:4184/lerolero/')
await new Promise((r) => setTimeout(r, 8000))
console.log(`carregamentos em 8 s: ${loads} (esperado: 2, a original e uma recuperação)`)
await browser.close()
