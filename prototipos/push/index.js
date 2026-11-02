import {
  $,
  b64u,
  copyText,
  encodeInvite,
  environment,
  generateVapid,
  pushService,
  randomId,
  sendPush,
  unb64u,
} from './comum.js'

const INVITE_KEY = 'lerolero.push.convite'
const banco = self.banco

function loadInvite() {
  try {
    return JSON.parse(localStorage.getItem(INVITE_KEY))
  } catch {
    return null
  }
}

function inviteLink(convite) {
  return new URL(`enviar.html#c=${encodeInvite(convite)}`, location.href).href
}

function showEnvironment() {
  $('#env').innerHTML = Object.entries(environment())
    .map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`)
    .join('')
}

function showInvite() {
  const convite = loadInvite()
  for (const id of ['#share-btn', '#copy-link-btn', '#self-btn']) $(id).disabled = !convite
  if (!convite) {
    $('#sub-out').innerHTML = '<p class="hint">Ainda não ativado neste aparelho.</p>'
    $('#link').value = ''
    return
  }
  $('#sub-out').innerHTML =
    `<p class="ok">Ativado. Serviço de push: <b>${pushService(convite.endereco)}</b>, chave VAPID ` +
    `${convite.vapid.publica.slice(0, 12)}…, desde ${new Date(convite.criadoEm).toLocaleString('pt-BR')}.</p>`
  $('#link').value = inviteLink(convite)
}

async function subscribe(rotate) {
  const reg = await navigator.serviceWorker.register('sw.js')
  await navigator.serviceWorker.ready
  const old = await reg.pushManager.getSubscription()
  // ativar de novo (na aba e depois no app instalado) não pode cancelar a inscrição do link já compartilhado
  if (!rotate && old && old.endpoint === loadInvite()?.endereco) return loadInvite()
  const vapid = await generateVapid()
  // outra chave VAPID exige outra inscrição; a antiga deixa de valer (é o que corta quem foi bloqueado)
  if (old) await old.unsubscribe()
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: unb64u(vapid.publica),
  })
  const convite = {
    endereco: sub.endpoint,
    p256dh: b64u(sub.getKey('p256dh')),
    auth: b64u(sub.getKey('auth')),
    vapid,
    criadoEm: Date.now(),
  }
  localStorage.setItem(INVITE_KEY, JSON.stringify(convite))
  // o nome que o service worker procura no banco, como o app faria com o contato
  await banco.put('contatos', { id: 'teste', nome: 'Contato do teste (nome lido no aparelho)' })
  return convite
}

async function enable(button, rotate) {
  const out = $('#sub-out')
  button.disabled = true
  try {
    const perm = await Notification.requestPermission()
    showEnvironment()
    if (perm !== 'granted') {
      out.innerHTML = `<p class="err">Permissão de notificação: ${perm}.</p>`
      return
    }
    await subscribe(rotate)
    showInvite()
  } catch (err) {
    out.innerHTML = `<p class="err">${err.name}: ${err.message}</p>`
  } finally {
    button.disabled = false
  }
}

async function showReceived() {
  const rows = (await banco.all('recebidos')).sort((a, b) => b.recebidoEm - a.recebidoEm)
  const fmt = (t) => (t ? new Date(t).toLocaleTimeString('pt-BR') : '—')
  const ms = (n) => (n == null ? '—' : n < 10000 ? `${n} ms` : `${Math.round(n / 1000)} s`)
  $('#received').innerHTML =
    '<tr><th>id</th><th>enviado</th><th>recebido</th><th>atraso</th><th>janelas</th><th>nome no aparelho</th></tr>' +
    rows
      .map(
        (r) =>
          `<tr><td>${r.evento ?? r.id}</td><td>${fmt(r.enviadoEm)}</td><td>${fmt(r.recebidoEm)}</td>` +
          `<td>${ms(r.atrasoMs)}</td><td>${r.janelasAbertas ?? '—'}${r.janelaVisivel ? ' (visível)' : ''}</td>` +
          `<td>${r.nomeNoAparelho ?? '—'}</td></tr>`,
      )
      .join('')
  const convite = loadInvite()
  $('#json').value = JSON.stringify(
    {
      ambiente: environment(),
      servico: convite ? pushService(convite.endereco) : null,
      recebidos: rows,
    },
    null,
    2,
  )
}

$('#enable-btn').onclick = (e) => enable(e.currentTarget, false)
$('#rotate-btn').onclick = (e) => enable(e.currentTarget, true)

$('#share-btn').onclick = async () => {
  const url = $('#link').value
  try {
    await navigator.share({ title: 'Convite do teste de notificação', url })
  } catch {
    await copyText(url, $('#link-status'))
  }
}
$('#copy-link-btn').onclick = () => copyText($('#link').value, $('#link-status'))

$('#self-btn').onclick = async () => {
  const out = $('#self-out')
  out.innerHTML = '<p class="hint">Enviando…</p>'
  const p = { id: randomId(), enviadoEm: Date.now(), de: 'este aparelho', contato: 'teste' }
  const r = await sendPush(loadInvite(), p)
  out.innerHTML = r.ok
    ? `<p class="ok">O serviço aceitou (${r.status}, ${r.ms} ms). A notificação deve aparecer.</p>`
    : `<p class="err">Falhou: ${r.status ?? r.erro} ${r.resposta ?? ''}</p>`
}

$('#copy-btn').onclick = async () => {
  await showReceived()
  copyText($('#json').value, $('#copy-status'))
}
$('#clear-btn').onclick = async () => {
  if (!confirm('Apagar os avisos anotados neste aparelho?')) return
  await banco.clear('recebidos')
  showReceived()
}

// ao voltar para o app, mostrar o que chegou enquanto ele estava fechado
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && showReceived())
navigator.serviceWorker?.register('sw.js')

showEnvironment()
showInvite()
showReceived()
