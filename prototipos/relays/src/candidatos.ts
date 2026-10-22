// Descobre candidatos olhando o que os usuários publicam na rede:
// kind 10050 (relays de DM, NIP-17) e kind 10063 (servidores Blossom, BUD-03).
import { mkdirSync, writeFileSync } from 'node:fs'
import type { Event } from 'nostr-tools/pure'
import { Connection, normalizeUrl } from './cliente.ts'

const SOURCES = [
  'wss://purplepag.es',
  'wss://user.kindpag.es',
  'wss://indexer.coracle.social',
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
]
const PAGES = 10
const PAGE_SIZE = 500

// pagina para trás com `until`, guardando só o evento mais recente de cada pessoa
async function collect(url: string, kind: number, latest: Map<string, Event>) {
  let conn: Connection | undefined
  try {
    conn = await Connection.open(url)
    let until: number | undefined
    for (let page = 0; page < PAGES; page++) {
      const { events, closed } = await conn.req([{ kinds: [kind], limit: PAGE_SIZE, ...(until ? { until } : {}) }])
      for (const e of events) {
        const prev = latest.get(e.pubkey)
        if (!prev || prev.created_at < e.created_at) latest.set(e.pubkey, e)
      }
      if (closed || events.length === 0) break
      const oldest = Math.min(...events.map((e) => e.created_at))
      if (until !== undefined && oldest >= until) break
      until = oldest - 1
    }
  } catch (err) {
    console.error(`  ${url} (kind ${kind}): ${(err as Error).message}`)
  } finally {
    conn?.close()
  }
}

function rank(latest: Map<string, Event>, tagName: string) {
  const counts = new Map<string, number>()
  for (const e of latest.values()) {
    const urls = new Set(e.tags.filter((t) => t[0] === tagName && t[1]).map((t) => normalizeUrl(t[1])))
    for (const u of urls) if (u) counts.set(u, (counts.get(u) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([url, users]) => ({ url, users }))
}

const result: Record<string, unknown> = { data: new Date().toISOString(), fontes: SOURCES }
for (const [kind, tag, key] of [
  [10050, 'relay', 'relaysDeDm'],
  [10063, 'server', 'blossom'],
] as const) {
  const latest = new Map<string, Event>()
  console.log(`kind ${kind}…`)
  await Promise.all(SOURCES.map((url) => collect(url, kind, latest)))
  const ranking = rank(latest, tag)
  result[key] = { pessoas: latest.size, ranking }
  console.log(`  ${latest.size} pessoas; mais usados:`)
  for (const r of ranking.slice(0, 25)) console.log(`  ${String(r.users).padStart(5)}  ${r.url}`)
}

mkdirSync('resultados', { recursive: true })
writeFileSync('resultados/candidatos.json', JSON.stringify(result, null, 2))
console.log('salvo em resultados/candidatos.json')
