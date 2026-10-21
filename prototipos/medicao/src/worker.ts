// Testes de CPU e memória, fora da thread principal (docs/05-arquitetura.md).
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure'
import { wrapManyEvents, unwrapEvent } from 'nostr-tools/nip17'
import { minePow } from 'nostr-tools/nip13'
import { argon2idAsync } from '@noble/hashes/argon2.js'
import { argon2id } from 'hash-wasm'
import { summarize } from './stats'

export type Task =
  | { kind: 'nip17'; runs: number }
  | { kind: 'argon2'; impl: 'noble' | 'wasm'; runs: number }
  | { kind: 'pow'; difficulties: number[]; maxRunsPerLevel: number; budgetMs: number }

type Request = { id: number; task: Task }

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<Request>) => void) | null
  postMessage(msg: unknown): void
}

// Parâmetros mínimos da OWASP, como em docs/06-protocolo-e-dados.md §2
export const ARGON2 = { memoryKiB: 19 * 1024, iterations: 2, parallelism: 1, hashLength: 32 }

const MESSAGE = 'Oi! Tudo bem? Chego aí em uns 15 minutos, pode ir pedindo o almoço 🙂'

function timed<T>(fn: () => T): [T, number] {
  const t0 = performance.now()
  const r = fn()
  return [r, performance.now() - t0]
}

async function timedAsync<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t0 = performance.now()
  const r = await fn()
  return [r, performance.now() - t0]
}

function nip17(runs: number) {
  const sender = generateSecretKey()
  const recipient = generateSecretKey()
  const recipientPub = getPublicKey(recipient)
  const wrapTimes: number[] = []
  const unwrapTimes: number[] = []
  let wrapBytes = 0
  for (let i = 0; i < runs; i++) {
    // um gift wrap para o destinatário e outro para o próprio remetente
    const [wraps, tw] = timed(() => wrapManyEvents(sender, [{ publicKey: recipientPub }], MESSAGE))
    wrapTimes.push(tw)
    const toRecipient = wraps.find((w) => w.tags.some((t) => t[0] === 'p' && t[1] === recipientPub))!
    wrapBytes = new TextEncoder().encode(JSON.stringify(toRecipient)).length
    const [rumor, tu] = timed(() => unwrapEvent(toRecipient, recipient))
    if (rumor.content !== MESSAGE) throw new Error('conteúdo decifrado não confere')
    unwrapTimes.push(tu)
  }
  const plainBytes = new TextEncoder().encode(MESSAGE).length
  return {
    wrap: summarize(wrapTimes),
    unwrap: summarize(unwrapTimes),
    wrapBytes,
    overheadBytes: wrapBytes - plainBytes,
  }
}

async function argon2(impl: 'noble' | 'wasm', runs: number) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const times: number[] = []
  for (let i = 0; i < runs; i++) {
    const [, t] = await timedAsync(() =>
      impl === 'noble'
        ? argon2idAsync('123456', salt, {
            m: ARGON2.memoryKiB,
            t: ARGON2.iterations,
            p: ARGON2.parallelism,
            dkLen: ARGON2.hashLength,
          })
        : argon2id({
            password: '123456',
            salt,
            memorySize: ARGON2.memoryKiB,
            iterations: ARGON2.iterations,
            parallelism: ARGON2.parallelism,
            hashLength: ARGON2.hashLength,
            outputType: 'binary',
          }),
    )
    times.push(t)
  }
  return { params: ARGON2, time: summarize(times) }
}

// A prova de trabalho é aleatória: medimos várias rodadas por dificuldade,
// dentro de um orçamento de tempo, e paramos de subir quando fica lenta demais.
function pow(difficulties: number[], maxRunsPerLevel: number, budgetMs: number) {
  const pubkey = getPublicKey(generateSecretKey())
  const levels = []
  for (const difficulty of difficulties) {
    const times: number[] = []
    const t0 = performance.now()
    while (times.length < maxRunsPerLevel && performance.now() - t0 < budgetMs) {
      const [, t] = timed(() =>
        minePow(
          { kind: 1059, created_at: Math.floor(Date.now() / 1000), tags: [], content: crypto.randomUUID(), pubkey },
          difficulty,
        ),
      )
      times.push(t)
    }
    const time = summarize(times)
    levels.push({ difficulty, time })
    if (time.median > 5000) break
  }
  return { levels }
}

ctx.onmessage = async ({ data: { id, task } }) => {
  try {
    let result: unknown
    if (task.kind === 'nip17') result = nip17(task.runs)
    else if (task.kind === 'argon2') result = await argon2(task.impl, task.runs)
    else result = pow(task.difficulties, task.maxRunsPerLevel, task.budgetMs)
    ctx.postMessage({ id, ok: true, result })
  } catch (err) {
    ctx.postMessage({ id, ok: false, error: String(err) })
  }
}

ctx.postMessage({ ready: true })
