export type Message = { id: number; mine: boolean; text: string; time: string }

const WORDS = (
  'oi tudo bem sim não talvez amanhã hoje cedo tarde noite almoço janta café mercado trabalho escola ' +
  'reunião ônibus chuva sol calor frio casa rua bairro festa aniversário mãe pai filho filha amigo ' +
  'vamos pode deixa beleza combinado certeza saudade obrigado valeu chegando atrasado pronto ' +
  'foto áudio mensagem celular bateria internet sinal domingo sábado segunda futebol jogo novela'
).split(' ')
const EMOJI = ['🙂', '😂', '👍', '❤️', '🙏', '🎉', '😅', '🔥']

// gerador determinístico (mulberry32): toda medição usa a mesma conversa
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Conversa fictícia: 60% mensagens curtas, 30% médias e 10% longas, algumas com emoji. */
export function generateMessages(n: number): Message[] {
  const rand = rng(42)
  const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)]
  const messages: Message[] = []
  let minutes = 8 * 60
  for (let id = 0; id < n; id++) {
    const r = rand()
    const words = r < 0.6 ? 1 + Math.floor(rand() * 8) : r < 0.9 ? 10 + Math.floor(rand() * 20) : 40 + Math.floor(rand() * 60)
    let text = Array.from({ length: words }, () => pick(WORDS)).join(' ')
    text = text[0].toUpperCase() + text.slice(1)
    if (rand() < 0.25) text += ' ' + pick(EMOJI)
    minutes = (minutes + Math.floor(rand() * 15)) % (24 * 60)
    const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
    messages.push({ id, mine: rand() < 0.45, text, time })
  }
  return messages
}
