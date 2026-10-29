// Código comum às páginas do protótipo: ambiente, registro dos resultados e frases de teste.
// Os resultados ficam no localStorage, porque cada teste troca de página ou depende do aviso do navegador.

const RESULTS_KEY = 'lerolero.senha.resultados'
const PHRASES_KEY = 'lerolero.senha.frases'

// Palavras da lista BIP-39 em português, só para a frase de teste ter o tamanho e o formato da real
const WORDS =
  'abacate abaixo abalar abater abduzir abelha aberto abismo abotoar abranger abreviar abrigar abrupto absinto absoluto absurdo abutre acabado acalmar acampar acanhar acaso aceitar acelerar acenar acervo acessar acetona achatar acidez acima acionado'.split(
    ' ',
  )

export const $ = (sel) => document.querySelector(sel)

export function displayMode() {
  if (matchMedia('(display-mode: standalone)').matches) return 'instalado'
  // Safari no iPhone
  if (navigator.standalone) return 'instalado'
  return 'aba do navegador'
}

export function environment() {
  return {
    userAgent: navigator.userAgent,
    modo: displayMode(),
    passwordCredential: 'PasswordCredential' in window,
    credentialsGet: !!navigator.credentials?.get,
  }
}

export function loadResults() {
  try {
    return JSON.parse(localStorage.getItem(RESULTS_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function record(test, outcome, extra = {}) {
  const results = loadResults()
  results.push({ teste: test, resultado: outcome, modo: displayMode(), data: new Date().toISOString(), ...extra })
  localStorage.setItem(RESULTS_KEY, JSON.stringify(results))
}

export function clearResults() {
  localStorage.removeItem(RESULTS_KEY)
  localStorage.removeItem(PHRASES_KEY)
}

// Cada variante, na aba e no app instalado, ganha um nome e uma frase próprios: no gerenciador de senhas dá para ver
// qual foi salva, e o app instalado não cai num "atualizar senha?" da conta salva pela aba
export function testAccount(test) {
  const variant = `${test} ${displayMode() === 'instalado' ? 'app' : 'aba'}`
  const phrases = loadPhrases()
  if (!phrases[variant]) {
    const n = crypto.getRandomValues(new Uint16Array(13))
    phrases[variant] = {
      nome: `Lero teste ${variant} ${(n[12] % 9000) + 1000}`,
      frase: Array.from(n.slice(0, 12), (x) => WORDS[x % WORDS.length]).join(' '),
    }
    localStorage.setItem(PHRASES_KEY, JSON.stringify(phrases))
  }
  return phrases[variant]
}

export function loadPhrases() {
  try {
    return JSON.parse(localStorage.getItem(PHRASES_KEY) ?? '{}')
  } catch {
    return {}
  }
}

// Pergunta à pessoa o que o navegador fez: a página não tem como saber se o aviso apareceu nem se ela salvou
export function askOutcome(container, test, onDone) {
  container.innerHTML = ''
  const p = document.createElement('p')
  p.textContent = 'O navegador ofereceu salvar a senha?'
  container.append(p)
  const options = [
    ['salvou', 'Ofereceu, e eu salvei'],
    ['ofereceu-recusei', 'Ofereceu, e eu não salvei'],
    ['nao-ofereceu', 'Não ofereceu'],
  ]
  for (const [outcome, label] of options) {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = label
    b.onclick = () => {
      record(test, outcome)
      container.innerHTML = `<p class="ok">Anotado: ${label.toLowerCase()}.</p>`
      onDone?.()
    }
    container.append(b)
  }
}
