import {
  $,
  buildPushRequest,
  copyText,
  curlCommand,
  decodeInvite,
  environment,
  pushService,
  randomId,
  sendPush,
} from './comum.js'

const SENT_KEY = 'lerolero.push.envios'

function loadSent() {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY) ?? '[]')
  } catch {
    return []
  }
}

function record(entry) {
  localStorage.setItem(SENT_KEY, JSON.stringify([...loadSent(), entry]))
  showSent()
}

function readInvite() {
  const out = $('#invite-out')
  try {
    const convite = decodeInvite($('#invite').value)
    // o começo da chave, para conferir com o que o celular mostra: link antigo dá 410 no envio
    out.innerHTML =
      `<p class="ok">Serviço de push: <b>${pushService(convite.endereco)}</b>, ` +
      `chave VAPID ${convite.vapid.publica.slice(0, 12)}….</p>`
    return convite
  } catch {
    out.innerHTML = '<p class="err">Cole o link do convite.</p>'
    return null
  }
}

function showSent() {
  const rows = loadSent().toReversed()
  const fmt = (t) => new Date(t).toLocaleTimeString('pt-BR')
  $('#sent').innerHTML =
    '<tr><th>id</th><th>como</th><th>enviado</th><th>resultado</th></tr>' +
    rows
      .map(
        (r) =>
          `<tr><td>${r.id}</td><td>${r.como}</td><td>${fmt(r.enviadoEm)}</td>` +
          `<td class="${r.ok === false ? 'err' : ''}">${r.status ?? r.erro ?? '—'} ${r.resposta ?? ''}</td></tr>`,
      )
      .join('')
  $('#json').value = JSON.stringify({ ambiente: environment(), envios: rows }, null, 2)
}

function payload() {
  return { id: randomId(), enviadoEm: Date.now(), de: $('#from').value || 'alguém', contato: 'teste' }
}

let countdown = null

$('#send-btn').onclick = () => {
  const convite = readInvite()
  if (!convite) return
  const minutes = Number($('#delay').value) || 0
  const due = Date.now() + minutes * 60_000
  const button = $('#send-btn')
  button.disabled = true
  clearInterval(countdown)
  // o timer de uma aba em segundo plano atrasa, mas o horário anotado é o do envio de verdade
  countdown = setInterval(async () => {
    const left = due - Date.now()
    if (left > 0) {
      $('#timer').textContent = `envia em ${Math.ceil(left / 1000)} s`
      return
    }
    clearInterval(countdown)
    $('#timer').textContent = ''
    const p = payload()
    const r = await sendPush(convite, p)
    record({ id: p.id, como: 'navegador', enviadoEm: p.enviadoEm, servico: pushService(convite.endereco), ...r })
    $('#send-out').innerHTML = r.ok
      ? `<p class="ok">O serviço aceitou (${r.status}, ${r.ms} ms).</p>`
      : r.status === 410
        ? '<p class="err">410: a inscrição foi trocada ou cancelada. Compartilhe o link de novo a partir do celular.</p>'
        : `<p class="err">Falhou: ${r.status ?? r.erro} ${r.resposta ?? ''}</p>`
    button.disabled = false
  }, 500)
}

$('#curl-btn').onclick = async () => {
  const convite = readInvite()
  if (!convite) return
  const p = payload()
  $('#curl').value = curlCommand(await buildPushRequest(convite, p))
  $('#curl').hidden = false
  $('#curl-hint').hidden = false
  record({ id: p.id, como: 'curl', enviadoEm: p.enviadoEm, servico: pushService(convite.endereco), status: 'gerado' })
}

$('#copy-btn').onclick = () => copyText($('#json').value, $('#copy-status'))
$('#clear-btn').onclick = () => {
  if (!confirm('Apagar os envios anotados neste aparelho?')) return
  localStorage.removeItem(SENT_KEY)
  showSent()
}

$('#invite').oninput = readInvite
if (location.hash.startsWith('#c=')) {
  $('#invite').value = location.href
  readInvite()
}
showSent()
