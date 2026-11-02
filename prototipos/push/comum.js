// Código comum às páginas do protótipo: chaves VAPID por pessoa, cifra do aviso (RFC 8291) e o envio ao endereço
// de push, tudo com o WebCrypto do navegador, sem biblioteca nem servidor.

export const $ = (sel) => document.querySelector(sel)

const enc = new TextEncoder()

export function b64u(bytes) {
  let s = ''
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b)
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

export function unb64u(text) {
  const s = atob(text.replaceAll('-', '+').replaceAll('_', '/'))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}

function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let i = 0
  for (const p of parts) {
    out.set(p, i)
    i += p.length
  }
  return out
}

export function displayMode() {
  if (matchMedia('(display-mode: standalone)').matches) return 'instalado'
  if (navigator.standalone) return 'instalado'
  return 'aba do navegador'
}

export function environment() {
  return {
    userAgent: navigator.userAgent,
    modo: displayMode(),
    serviceWorker: 'serviceWorker' in navigator,
    pushManager: 'PushManager' in window,
    notificacao: 'Notification' in window ? Notification.permission : 'sem suporte',
  }
}

// O par VAPID é só desta pessoa: a privada vai no convite (no app, no cartão de perfil) para os contatos assinarem
// o aviso sem servidor do projeto
export async function generateVapid() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  return { publica: b64u(raw), privada: jwk.d }
}

async function importVapid({ publica, privada }) {
  const raw = unb64u(publica)
  const jwk = { kty: 'EC', crv: 'P-256', x: b64u(raw.slice(1, 33)), y: b64u(raw.slice(33, 65)), d: privada }
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
}

// JWT ES256 (RFC 8292); a assinatura do WebCrypto já vem em r||s, o formato do JWS
async function vapidHeader(endpoint, vapid) {
  const header = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = b64u(
    enc.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: 'https://lerolero-app.github.io/lerolero/push/',
      }),
    ),
  )
  const key = await importVapid(vapid)
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`))
  return `vapid t=${header}.${claims}.${b64u(sig)}, k=${vapid.publica}`
}

async function hkdf(salt, ikm, info, bits) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bits))
}

// RFC 8291 com aes128gcm (RFC 8188), um registro só: o serviço de push vê só bytes cifrados
export async function encryptPayload(text, { p256dh, auth }) {
  const uaPublic = unb64u(p256dh)
  const authSecret = unb64u(auth)
  const ua = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey))
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: ua }, as.privateKey, 256))

  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic)
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 256)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 128)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 96)

  // 0x02 marca o último registro
  const padded = concat(enc.encode(text), Uint8Array.of(2))
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, padded))

  const rs = Uint8Array.of(0, 0, 0x10, 0) // 4096
  return concat(salt, rs, Uint8Array.of(asPublic.length), asPublic, cipher)
}

// O pedido inteiro ao serviço de push; Urgency high pede a prioridade que acorda o Android no modo Doze
export async function buildPushRequest(convite, payload) {
  const body = await encryptPayload(JSON.stringify(payload), convite)
  return {
    url: convite.endereco,
    headers: {
      TTL: '86400',
      Urgency: 'high',
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      Authorization: await vapidHeader(convite.endereco, convite.vapid),
    },
    body,
  }
}

// O mesmo pedido pelo terminal, onde não há CORS: separa "o navegador consegue mandar?" de "o aviso chega?"
export function curlCommand({ url, headers, body }) {
  const h = Object.entries(headers)
    .map(([k, v]) => `-H '${k}: ${v}'`)
    .join(' ')
  let bin = ''
  for (const b of body) bin += String.fromCharCode(b)
  return `echo '${btoa(bin)}' | base64 -d | curl -sS -i -X POST ${h} --data-binary @- '${url}'`
}

// POST direto do navegador; se o serviço recusar o CORS, o fetch falha sem status (TypeError)
export async function sendPush(convite, payload) {
  const req = await buildPushRequest(convite, payload)
  const inicio = Date.now()
  try {
    const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body })
    return { ok: res.ok, status: res.status, resposta: (await res.text()).slice(0, 300), ms: Date.now() - inicio }
  } catch (err) {
    return { ok: false, status: null, erro: `${err.name}: ${err.message} (CORS ou rede)`, ms: Date.now() - inicio }
  }
}

export function pushService(endpoint) {
  try {
    return new URL(endpoint).host
  } catch {
    return '?'
  }
}

export function randomId() {
  return b64u(crypto.getRandomValues(new Uint8Array(6)))
}

// O convite vai no fragmento do link (#c=...), que não chega ao servidor do GitHub Pages
export function encodeInvite(convite) {
  return b64u(enc.encode(JSON.stringify(convite)))
}

export function decodeInvite(text) {
  const t = text.trim()
  const raw = t.includes('#c=') ? t.slice(t.indexOf('#c=') + 3) : t
  return JSON.parse(new TextDecoder().decode(unb64u(raw)))
}

export async function copyText(text, status) {
  try {
    await navigator.clipboard.writeText(text)
    status.textContent = 'Copiado.'
  } catch {
    status.textContent = 'Não deu para copiar: selecione o texto à mão.'
  }
}
