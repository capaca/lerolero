import { Relay } from 'nostr-tools/relay'
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure'
import { wrapEvent } from 'nostr-tools/nip17'

export type RelayResult = {
  url: string
  connectMs?: number
  eoseMs?: number
  roundTripMs?: number
  auth: boolean
  error?: string
}

const TIMEOUT_MS = 10_000

function withTimeout<T>(p: Promise<T>, what: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${what}: tempo esgotado (${TIMEOUT_MS / 1000} s)`)), TIMEOUT_MS)),
  ])
}

/**
 * Mede, num relay: tempo de conexão; tempo até o fim do histórico (EOSE) de uma
 * assinatura de gift wraps; e, se `roundTrip`, o tempo entre publicar um gift wrap
 * e recebê-lo de volta pela assinatura (aproxima RNF-13).
 *
 * As chaves são descartáveis, criadas a cada medição.
 */
export async function measureRelay(url: string, roundTrip: boolean): Promise<RelayResult> {
  const result: RelayResult = { url, auth: false }
  const sender = generateSecretKey()
  const recipient = generateSecretKey()
  const recipientPub = getPublicKey(recipient)
  let relay: Relay | undefined

  try {
    let t0 = performance.now()
    relay = await withTimeout(Relay.connect(url), 'conexão')
    result.connectMs = performance.now() - t0

    const wrap = roundTrip ? wrapEvent(sender, { publicKey: recipientPub }, 'teste de ida e volta') : undefined
    let resolveReceived!: () => void
    const received = new Promise<void>((r) => (resolveReceived = r))

    const subscribeOnce = () =>
      new Promise<'eose' | 'auth-required'>((resolve, reject) => {
        relay!.subscribe([{ kinds: [1059], '#p': [recipientPub], limit: 1 }], {
          oneose: () => resolve('eose'),
          onevent: (e) => {
            if (e.id === wrap?.id) resolveReceived()
          },
          onclose: (reason) =>
            reason.includes('auth-required') ? resolve('auth-required') : reject(new Error(`assinatura fechada: ${reason}`)),
        })
      })

    t0 = performance.now()
    let outcome = await withTimeout(subscribeOnce(), 'EOSE')
    if (outcome === 'auth-required') {
      // NIP-42: autentica como o destinatário, que é quem lê os próprios gift wraps
      await withTimeout(relay.auth(async (template) => finalizeEvent(template, recipient)), 'autenticação')
      result.auth = true
      outcome = await withTimeout(subscribeOnce(), 'EOSE após autenticação')
      if (outcome === 'auth-required') throw new Error('relay exige autenticação e não aceitou a nossa')
    }
    result.eoseMs = performance.now() - t0

    if (wrap) {
      t0 = performance.now()
      await withTimeout(relay.publish(wrap), 'publicação')
      await withTimeout(received, 'recebimento')
      result.roundTripMs = performance.now() - t0
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
  } finally {
    relay?.close()
  }
  return result
}
