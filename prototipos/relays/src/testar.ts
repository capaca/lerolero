// Testa candidatos contra os critérios da Q-R1 (docs/05-arquitetura.md).
//   npm run testar -- relays    relays de DM (gift wraps, NIP-42, privacidade)
//   npm run testar -- blossom   servidores Blossom (binário cifrado, CORS)
//   npm run testar -- retencao  confere se o que foi publicado antes ainda está lá
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure'
import { wrapEvent } from 'nostr-tools/nip17'
import { bytesToHex, hexToBytes } from 'nostr-tools/utils'
import { Connection, timeout } from './cliente.ts'

const ORIGIN = 'https://capaca.github.io'
const RESULTS = 'resultados'
const RETENTION_FILE = `${RESULTS}/retencao.json`
const now = () => Math.floor(Date.now() / 1000)

type Candidates = { relaysDeDm: { ranking: { url: string; users: number }[] }; blossom: { ranking: { url: string; users: number }[] } }
type Published = { tipo: 'relay' | 'blossom'; url: string; id: string; quando: string; chave?: string }

function candidates(kind: 'relaysDeDm' | 'blossom', top: number) {
  const c: Candidates = JSON.parse(readFileSync(`${RESULTS}/candidatos.json`, 'utf8'))
  return c[kind].ranking.slice(0, top)
}

async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
      }
    }),
  )
  return out
}

function remember(entries: Published[]) {
  const prev: Published[] = existsSync(RETENTION_FILE) ? JSON.parse(readFileSync(RETENTION_FILE, 'utf8')) : []
  writeFileSync(RETENTION_FILE, JSON.stringify([...prev, ...entries], null, 2))
}

const short = (s: string, n = 60) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

// ---------- Relays ----------

type RelayReport = {
  url: string
  usuarios: number
  nip11?: { software?: string; nips?: number[]; authRequired?: boolean; paymentRequired?: boolean; countries?: string[] }
  conexaoMs?: number
  escrita?: string
  leituraSemAuth?: 'escondeu' | 'VAZOU'
  leituraOutraChave?: string
  leituraDestinatario?: string
  apto: boolean
  erro?: string
}

async function nip11(url: string) {
  try {
    const res = await timeout(fetch(url.replace(/^wss:/, 'https:'), { headers: { Accept: 'application/nostr+json' } }), 'NIP-11')
    const info: any = await res.json()
    return {
      software: info.software ? short(String(info.software).replace(/^git\+|https?:\/\/(github\.com\/)?/g, ''), 40) : undefined,
      nips: info.supported_nips,
      authRequired: info.limitation?.auth_required,
      paymentRequired: info.limitation?.payment_required,
      countries: info.relay_countries,
    }
  } catch {
    return undefined
  }
}

/**
 * Procura o gift wrap `id` pedindo os gift wraps endereçados a `recipientPub` (filtro #p),
 * como faria quem quer descobrir quem recebe mensagens. Autentica com `key` se o relay pedir.
 */
async function readAs(
  url: string,
  id: string,
  recipientPub: string,
  key?: Uint8Array,
): Promise<{ found: boolean; authFailed?: string }> {
  const conn = await Connection.open(url)
  try {
    const filter = { kinds: [1059], '#p': [recipientPub] }
    let r = await conn.req([filter])
    if (key && (r.closed?.includes('auth-required') || r.events.length === 0)) {
      const auth = await conn.auth(key)
      if (!auth.ok && r.closed) return { found: false, authFailed: short(auth.message, 50) }
      r = await conn.req([filter])
    }
    return { found: r.events.some((e) => e.id === id) }
  } finally {
    conn.close()
  }
}

async function testRelay({ url, users }: { url: string; users: number }): Promise<[RelayReport, Published?]> {
  const report: RelayReport = { url, usuarios: users, apto: false }
  report.nip11 = await nip11(url)
  const sender = generateSecretKey()
  const recipient = generateSecretKey()
  const stranger = generateSecretKey()
  // created_at recuado em até 2 dias, como manda o NIP-59
  const wrap = wrapEvent(sender, { publicKey: getPublicKey(recipient) }, 'teste de relay do Lero-lero')
  let published: Published | undefined

  try {
    const t0 = performance.now()
    const conn = await Connection.open(url)
    report.conexaoMs = Math.round(performance.now() - t0)
    try {
      let pub = await conn.publish(wrap)
      if (!pub.ok && pub.message.startsWith('auth-required')) {
        // alguns relays exigem autenticação até para escrever: o remetente usa uma chave qualquer
        await conn.auth(generateSecretKey())
        pub = await conn.publish(wrap)
      }
      report.escrita = pub.ok ? 'aceitou' : `recusou: ${short(pub.message)}`
      if (!pub.ok) return [report]
      published = { tipo: 'relay', url, id: wrap.id, quando: new Date().toISOString(), chave: bytesToHex(recipient) }
    } finally {
      conn.close()
    }
    await new Promise((r) => setTimeout(r, 1000)) // alguns relays gravam de forma assíncrona

    const recipientPub = getPublicKey(recipient)
    report.leituraSemAuth = (await readAs(url, wrap.id, recipientPub)).found ? 'VAZOU' : 'escondeu'
    const asStranger = await readAs(url, wrap.id, recipientPub, stranger)
    report.leituraOutraChave = asStranger.found ? 'VAZOU' : asStranger.authFailed ? `auth falhou: ${asStranger.authFailed}` : 'escondeu'
    const asRecipient = await readAs(url, wrap.id, recipientPub, recipient)
    report.leituraDestinatario = asRecipient.found
      ? 'recebeu'
      : asRecipient.authFailed
        ? `auth falhou: ${asRecipient.authFailed}`
        : 'não recebeu'

    report.apto =
      report.leituraSemAuth === 'escondeu' && report.leituraOutraChave === 'escondeu' && report.leituraDestinatario === 'recebeu'
  } catch (err) {
    report.erro = (err as Error).message
  }
  return [report, published]
}

async function relays(top: number) {
  const list = candidates('relaysDeDm', top)
  console.log(`Testando ${list.length} relays de DM…\n`)
  const results = await pool(list, 6, testRelay)
  const reports = results.map(([r]) => r)
  remember(results.flatMap(([, p]) => (p ? [p] : [])))

  for (const r of reports) {
    const verdict = r.apto ? 'APTO ' : '     '
    const detail = r.erro
      ? `erro: ${r.erro}`
      : [
          r.escrita,
          r.leituraSemAuth && `sem auth: ${r.leituraSemAuth}`,
          r.leituraOutraChave && `outra chave: ${r.leituraOutraChave}`,
          r.leituraDestinatario && `destinatário: ${r.leituraDestinatario}`,
        ]
          .filter(Boolean)
          .join(' | ')
    console.log(`${verdict} ${r.url.padEnd(38)} ${String(r.conexaoMs ?? '—').padStart(5)} ms  ${detail}`)
  }
  save('relays', reports)
}

// ---------- Blossom ----------

type BlossomReport = {
  url: string
  usuarios: number
  envio?: string
  download?: string
  corsGet?: boolean
  corsPut?: boolean
  apto: boolean
  erro?: string
}

function blossomAuth(key: Uint8Array, verb: 'upload' | 'delete' | 'get', sha256: string) {
  const event = finalizeEvent(
    {
      kind: 24242,
      created_at: now(),
      tags: [
        ['t', verb],
        ['x', sha256],
        ['expiration', String(now() + 600)],
      ],
      content: `Lero-lero: teste de ${verb}`,
    },
    key,
  )
  return `Nostr ${Buffer.from(JSON.stringify(event)).toString('base64')}`
}

async function testBlossom({ url, users }: { url: string; users: number }): Promise<[BlossomReport, Published?]> {
  const report: BlossomReport = { url, usuarios: users, apto: false }
  const key = generateSecretKey()
  // 4 KB aleatórios: do ponto de vista do servidor, igual a uma mídia cifrada
  const blob = randomBytes(4096)
  const sha256 = createHash('sha256').update(blob).digest('hex')
  let published: Published | undefined
  try {
    const preflight = await timeout(
      fetch(`${url}/upload`, {
        method: 'OPTIONS',
        headers: {
          Origin: ORIGIN,
          'Access-Control-Request-Method': 'PUT',
          'Access-Control-Request-Headers': 'authorization,content-type,x-sha-256',
        },
      }),
      'CORS',
    )
    const allowOrigin = preflight.headers.get('access-control-allow-origin')
    report.corsPut = preflight.ok && (allowOrigin === '*' || allowOrigin === ORIGIN)

    const up = await timeout(
      fetch(`${url}/upload`, {
        method: 'PUT',
        headers: {
          Authorization: blossomAuth(key, 'upload', sha256),
          'Content-Type': 'application/octet-stream',
          'X-SHA-256': sha256,
        },
        body: blob,
      }),
      'envio',
      20_000,
    )
    if (!up.ok) {
      report.envio = `recusou (${up.status}): ${short(up.headers.get('x-reason') ?? (await up.text()).replace(/\s+/g, ' '))}`
      return [report]
    }
    const descriptor: any = await up.json()
    report.envio = 'aceitou'
    published = { tipo: 'blossom', url, id: sha256, quando: new Date().toISOString(), chave: bytesToHex(key) }

    const get = await timeout(fetch(descriptor.url ?? `${url}/${sha256}`, { headers: { Origin: ORIGIN } }), 'download', 20_000)
    const back = Buffer.from(await get.arrayBuffer())
    report.download = get.ok && back.equals(blob) ? 'íntegro' : `falhou (${get.status}, ${back.length} bytes)`
    const getOrigin = get.headers.get('access-control-allow-origin')
    report.corsGet = getOrigin === '*' || getOrigin === ORIGIN

    report.apto = report.download === 'íntegro' && !!report.corsGet && !!report.corsPut
  } catch (err) {
    report.erro = (err as Error).message
  }
  return [report, published]
}

async function blossom(top: number) {
  const list = candidates('blossom', top).filter((c) => !c.url.endsWith('.test'))
  console.log(`Testando ${list.length} servidores Blossom…\n`)
  const results = await pool(list, 6, testBlossom)
  const reports = results.map(([r]) => r)
  remember(results.flatMap(([, p]) => (p ? [p] : [])))
  for (const r of reports) {
    const detail = r.erro
      ? `erro: ${r.erro}`
      : [r.envio, r.download && `download: ${r.download}`, `CORS: ${r.corsPut ? 'envio ok' : 'envio NÃO'}, ${r.corsGet ? 'leitura ok' : r.download ? 'leitura NÃO' : '—'}`]
          .filter(Boolean)
          .join(' | ')
    console.log(`${r.apto ? 'APTO ' : '     '} ${r.url.padEnd(34)} ${detail}`)
  }
  save('blossom', reports)
}

// ---------- Retenção ----------

async function retention() {
  if (!existsSync(RETENTION_FILE)) return console.log('Nada publicado ainda. Rode "relays" e "blossom" antes.')
  const entries: Published[] = JSON.parse(readFileSync(RETENTION_FILE, 'utf8'))
  const results = await pool(entries, 6, async (p) => {
    const days = ((Date.now() - Date.parse(p.quando)) / 86_400_000).toFixed(1)
    try {
      let present: boolean
      if (p.tipo === 'relay') {
        const key = hexToBytes(p.chave!)
        present = (await readAs(p.url, p.id, getPublicKey(key), key)).found
      }
      else present = (await timeout(fetch(`${p.url}/${p.id}`, { method: 'HEAD' }), 'HEAD')).ok
      return { ...p, dias: Number(days), presente: present }
    } catch (err) {
      return { ...p, dias: Number(days), presente: false, erro: (err as Error).message }
    }
  })
  for (const r of results)
    console.log(`${r.presente ? 'ainda lá ' : 'SUMIU    '} ${r.dias.toFixed(1).padStart(5)} dias  ${r.tipo.padEnd(7)} ${r.url}${'erro' in r ? `  (${r.erro})` : ''}`)
  save('retencao', results.map(({ chave, ...r }) => r))
}

function save(name: string, data: unknown) {
  mkdirSync(RESULTS, { recursive: true })
  const file = `${RESULTS}/${name}-${new Date().toISOString().slice(0, 10)}.json`
  writeFileSync(file, JSON.stringify(data, null, 2))
  console.log(`\nsalvo em ${file}`)
}

const [command, top = '30'] = process.argv.slice(2)
if (command === 'relays') await relays(Number(top))
else if (command === 'blossom') await blossom(Number(top))
else if (command === 'retencao') await retention()
else console.log('uso: npm run testar -- relays|blossom|retencao [quantos candidatos]')
process.exit(0)
