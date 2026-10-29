import { $, askOutcome, clearResults, environment, loadPhrases, loadResults, record, testAccount } from './comum.js'

function fill(form, variant) {
  const { nome, frase } = testAccount(variant)
  form.username.value = nome
  form.password.value = frase
}

function showEnvironment() {
  const rows = Object.entries(environment()).map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`)
  $('#env').innerHTML = rows.join('')
}

function showResults() {
  $('#json').value = JSON.stringify({ ambiente: environment(), frases: loadPhrases(), resultados: loadResults() }, null, 2)
}

// A: o Chrome reconhece o envio quando um fetch termina e o formulário sai da página
const formA = $('#form-a')
fill(formA, 'A')
formA.onsubmit = async (e) => {
  e.preventDefault()
  await fetch('comum.js', { cache: 'no-store' })
  formA.remove()
  askOutcome($('#out-a'), 'A-fetch', showResults)
}

// B: troca de página logo depois do envio; a pergunta fica na página seguinte
const formB = $('#form-b')
fill(formB, 'B')
formB.onsubmit = (e) => {
  e.preventDefault()
  location.assign('salvo.html')
}

$('#btn-c').onclick = async () => {
  const out = $('#out-c')
  if (!('PasswordCredential' in window)) {
    record('C-PasswordCredential', 'sem-suporte')
    out.innerHTML = '<p class="err">Este navegador não tem PasswordCredential.</p>'
    showResults()
    return
  }
  const { nome, frase } = testAccount('C')
  try {
    // o id é o nome que aparece no gerenciador; o app usaria um nome legível, não a npub
    await navigator.credentials.store(new PasswordCredential({ id: nome, password: frase, name: nome }))
    askOutcome(out, 'C-PasswordCredential', showResults)
  } catch (err) {
    record('C-PasswordCredential', 'erro', { erro: String(err) })
    out.innerHTML = `<p class="err">${err}</p>`
    showResults()
  }
}

$('#copy-btn').onclick = async () => {
  showResults()
  try {
    await navigator.clipboard.writeText($('#json').value)
    $('#copy-status').textContent = 'Copiado.'
  } catch {
    $('#json').select()
    $('#copy-status').textContent = 'Selecionado: copie à mão.'
  }
}

$('#clear-btn').onclick = () => {
  if (!confirm('Apagar os resultados e as frases de teste deste aparelho?')) return
  clearResults()
  location.reload()
}

showEnvironment()
showResults()
