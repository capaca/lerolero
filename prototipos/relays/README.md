# Pesquisa de relays e servidores Blossom (Q-R1)

Ferramenta para escolher a lista padrão (`relays.json` na raiz) com dados, não com palpite.

```sh
npm ci
npm run candidatos                 # o que os usuários publicam: kind 10050 (relays de DM) e 10063 (Blossom)
npm run testar -- relays 100       # testa os 100 relays de DM mais usados
npm run testar -- blossom 30       # testa os 30 servidores Blossom mais usados
npm run testar -- retencao         # confere se o que foi publicado ainda está lá (rodar depois de 7 dias)
```

Os resultados ficam em `resultados/`, fora do git: o arquivo de retenção guarda as chaves descartáveis usadas no teste.

## Critérios

**Relay de DM apto:** aceita um gift wrap com data recuada (como o NIP-59 manda); **não** entrega os gift wraps de uma pessoa a quem pergunta sem autenticação, nem a quem se autentica com outra chave; entrega ao destinatário autenticado (NIP-42). A pergunta é feita pelo filtro `#p`, como faria quem quer descobrir quem recebe mensagens.

**Servidor Blossom apto:** aceita um arquivo binário opaco (`application/octet-stream`, igual a uma mídia cifrada), devolve os mesmos bytes e responde com CORS para o PWA, tanto no envio quanto na leitura.

## Resultados de 2026-10-22

Medido de um Mac no Brasil.

**Uso na rede:** 9420 pessoas com relays de DM publicados; 8268 com servidores Blossom.

**Relays de DM (100 mais usados):**

| Situação | Quantos |
|---|---|
| Entregam os gift wraps a qualquer um (vazam quem recebe mensagens e quando) | 46 |
| Recusam gift wraps | 28 |
| Erro de conexão ou tempo esgotado | 13 |
| Protegem, mas também não entregam ao destinatário | 6 |
| **Aptos** | **7** |

| Relay apto | Usuários | Hospedagem | Software |
|---|---|---|---|
| auth.nostr1.com | 1289 | EUA (Contabo) | strfry |
| relay.nmail.li | 239 | França (OVH) | nostr-relay |
| relay.monostr.com | 40 | Alemanha (Hetzner) | strfry |
| relay.formstr.app | 5 | Cloudflare | nostream |
| relay.psstpsst.chat | 5 | Cloudflare | próprio |
| nostr-01.uid.ovh | 4 | França (OVH), **mesmo IP do nmail.li** | nostr-relay |
| mihhdu.org/nostr | 2 | Suíça (Infomaniak) | próprio |

Os mais populares (Primal, nos.lol, damus) não servem: os dois primeiros entregam a qualquer um; o damus recusa a autenticação por erro de configuração do próprio relay. **Nenhum relay apto fica no Brasil** (Q-D2).

**Servidores Blossom (27 testados):** 10 aptos. Os cinco mais usados (Primal, nostrcheck, nostr.media, nostr.build, blossom.band) **recusam binário opaco**, ou seja, recusam mídia cifrada. Aptos: nostr.download (Irlanda), blossom.data.haus (Alemanha), blossom.ditto.pub (EUA), files.sovbit.host (Finlândia), cdn.hzrd149.com (EUA), blossom.yakihonne.com (Singapura), blossom.jumble.social (Cloudflare) e três do mesmo operador do nmail.li (blossom.nmail.li, blossom-01 e blossom-02.uid.ovh).

## Lista provisória

Em `relays.json`, escolhida com **operadores diferentes** (RNF-30): três relays de DM (o NIP-17 recomenda de 1 a 3 no kind 10050 de cada pessoa) e dois Blossom (ADR-0004), mais reservas. Os relays "gerais" servem para publicar e achar o kind 10050 e o perfil, não para mensagens.

**Pendente:** a retenção de 7 dias só pode ser confirmada a partir de 2026-10-29 (`npm run testar -- retencao`). Relays aptos com 2 a 5 usuários são de operadores pequenos: bons como reserva, arriscados como padrão.
