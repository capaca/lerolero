import { $, loadPhrases, record } from './comum.js'

// Diz de qual variante veio a frase e se ela chegou inteira; em outro aparelho não há frases locais para comparar,
// então vale a contagem de palavras
function check(name, phrase) {
  const words = phrase.trim().split(/\s+/).filter(Boolean)
  const known = Object.entries(loadPhrases()).find(([, p]) => p.nome === name)
  if (known) return { variante: known[0], inteira: known[1].frase === phrase, palavras: words.length }
  return { variante: 'desconhecida', inteira: words.length === 12, palavras: words.length }
}

function show(out, test, name, phrase) {
  const r = check(name, phrase)
  record(test, r.inteira ? 'frase-inteira' : 'frase-diferente', r)
  out.innerHTML = r.inteira
    ? `<p class="ok">Voltou a frase inteira de "${name}" (${r.palavras} palavras).</p>`
    : `<p class="err">Voltou "${name}", mas a frase não confere (${r.palavras} palavras).</p>`
}

const form = $('#form')
form.onsubmit = (e) => {
  e.preventDefault()
  if (!form.password.value) {
    $('#out-form').innerHTML = '<p class="err">O código está vazio.</p>'
    return
  }
  show($('#out-form'), 'restaurar-preenchimento', form.username.value, form.password.value)
}

$('#none-btn').onclick = () => {
  record('restaurar-preenchimento', 'nao-sugeriu')
  $('#out-form').innerHTML = '<p class="ok">Anotado: não sugeriu.</p>'
}

$('#get-btn').onclick = async () => {
  const out = $('#out-get')
  if (!navigator.credentials?.get || !('PasswordCredential' in window)) {
    record('restaurar-credentials-get', 'sem-suporte')
    out.innerHTML = '<p class="err">Este navegador não entrega senhas por código.</p>'
    return
  }
  try {
    const cred = await navigator.credentials.get({ password: true, mediation: 'optional' })
    if (!cred) {
      record('restaurar-credentials-get', 'nada')
      out.innerHTML = '<p class="err">O navegador não devolveu nenhuma senha.</p>'
      return
    }
    show(out, 'restaurar-credentials-get', cred.id, cred.password ?? '')
  } catch (err) {
    record('restaurar-credentials-get', 'erro', { erro: String(err) })
    out.innerHTML = `<p class="err">${err}</p>`
  }
}
