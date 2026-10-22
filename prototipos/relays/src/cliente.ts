// Cliente Nostr mínimo sobre WebSocket, para testar relays vendo as respostas cruas.
import { finalizeEvent, type Event } from 'nostr-tools/pure'
import type { Filter } from 'nostr-tools/filter'

export const TIMEOUT_MS = 10_000

export function timeout<T>(p: Promise<T>, what: string, ms = TIMEOUT_MS): Promise<T> {
  let timer: NodeJS.Timeout
  return Promise.race([
    p,
    new Promise<T>((_, reject) => (timer = setTimeout(() => reject(new Error(`${what}: tempo esgotado`)), ms))),
  ]).finally(() => clearTimeout(timer))
}

export type ReqResult = { events: Event[]; closed?: string }

export class Connection {
  challenge?: string
  private listeners = new Set<(msg: any[]) => void>()
  private nextSub = 0

  readonly url: string
  private ws: WebSocket

  private constructor(url: string, ws: WebSocket) {
    this.url = url
    this.ws = ws
    ws.addEventListener('message', (e) => {
      let msg: any[]
      try {
        msg = JSON.parse(String(e.data))
      } catch {
        return
      }
      if (msg[0] === 'AUTH') this.challenge = msg[1]
      for (const l of this.listeners) l(msg)
    })
  }

  static open(url: string): Promise<Connection> {
    return timeout(
      new Promise((resolve, reject) => {
        const ws = new WebSocket(url)
        ws.addEventListener('open', () => resolve(new Connection(url, ws)))
        ws.addEventListener('error', () => reject(new Error('falha na conexão')))
      }),
      'conexão',
    )
  }

  close() {
    try {
      this.ws.close()
    } catch {}
  }

  private waitFor<T>(match: (msg: any[]) => T | undefined, what: string): Promise<T> {
    let listener!: (msg: any[]) => void
    return timeout(
      new Promise<T>((resolve) => {
        listener = (msg) => {
          const r = match(msg)
          if (r !== undefined) resolve(r)
        }
        this.listeners.add(listener)
      }),
      what,
    ).finally(() => this.listeners.delete(listener))
  }

  /** REQ até EOSE ou CLOSED; devolve os eventos e o motivo, se o relay fechou. */
  async req(filters: Filter[]): Promise<ReqResult> {
    const id = `s${this.nextSub++}`
    const events: Event[] = []
    const done = this.waitFor((msg) => {
      if (msg[1] !== id) return undefined
      if (msg[0] === 'EVENT') events.push(msg[2])
      if (msg[0] === 'EOSE') return { events }
      if (msg[0] === 'CLOSED') return { events, closed: String(msg[2] ?? '') }
      return undefined
    }, 'REQ')
    this.ws.send(JSON.stringify(['REQ', id, ...filters]))
    const result = await done
    if (!result.closed) this.ws.send(JSON.stringify(['CLOSE', id]))
    return result
  }

  /** Publica e espera o OK. */
  async publish(event: Event): Promise<{ ok: boolean; message: string }> {
    const done = this.waitFor(
      (msg) => (msg[0] === 'OK' && msg[1] === event.id ? { ok: Boolean(msg[2]), message: String(msg[3] ?? '') } : undefined),
      'publicação',
    )
    this.ws.send(JSON.stringify(['EVENT', event]))
    return done
  }

  /** NIP-42: responde ao desafio que o relay mandou (espera um pouco por ele, se ainda não chegou). */
  async auth(secretKey: Uint8Array): Promise<{ ok: boolean; message: string }> {
    if (!this.challenge) await this.waitFor((msg) => (msg[0] === 'AUTH' ? true : undefined), 'desafio AUTH').catch(() => {})
    if (!this.challenge) return { ok: false, message: 'o relay não enviou desafio AUTH' }
    const event = finalizeEvent(
      {
        kind: 22242,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['relay', this.url],
          ['challenge', this.challenge],
        ],
        content: '',
      },
      secretKey,
    )
    const done = this.waitFor(
      (msg) => (msg[0] === 'OK' && msg[1] === event.id ? { ok: Boolean(msg[2]), message: String(msg[3] ?? '') } : undefined),
      'AUTH',
    )
    this.ws.send(JSON.stringify(['AUTH', event]))
    return done
  }
}

export function normalizeUrl(url: string): string | undefined {
  try {
    const u = new URL(url.trim())
    if (u.protocol !== 'wss:' && u.protocol !== 'https:') return undefined
    return `${u.protocol}//${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, '')}`
  } catch {
    return undefined
  }
}
