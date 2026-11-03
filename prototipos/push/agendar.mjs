// Envia avisos ao celular em horários marcados, pelo Node (sem CORS), com o mesmo código da página do remetente.
// O horário vai dentro do aviso no momento do envio, então o atraso anotado no celular é o de verdade.
// Uso: caffeinate -i node prototipos/push/agendar.mjs '<link do convite>' 60 180
//      (minutos a partir de agora; sem números, envia na hora). O caffeinate impede o Mac de dormir e parar o envio.
import { decodeInvite, pushService, randomId, sendPush } from './comum.js'

const [link, ...delays] = process.argv.slice(2)
if (!link) {
  console.error("uso: node prototipos/push/agendar.mjs '<link do convite>' [minutos...]")
  process.exit(1)
}
const convite = decodeInvite(link)
const minutes = delays.length ? delays.map(Number) : [0]
const start = Date.now()
const hora = (t) => new Date(t).toLocaleTimeString('pt-BR')

console.log(`${pushService(convite.endereco)}, chave VAPID ${convite.vapid.publica.slice(0, 12)}…`)
for (const m of minutes) console.log(`envio marcado para ${hora(start + m * 60_000)}`)

for (const m of minutes) {
  await new Promise((r) => setTimeout(r, Math.max(0, start + m * 60_000 - Date.now())))
  const p = { id: randomId(), enviadoEm: Date.now(), de: `Lero push (${m} min)`, contato: 'teste' }
  const r = await sendPush(convite, p)
  console.log(`${hora(p.enviadoEm)} ${p.id}: ${r.status ?? r.erro} ${r.resposta?.trim() ?? ''}`)
}
