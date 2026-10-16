# ADR-0001: Protocolo de transporte

- **Status:** aceito
- **Data:** 2026-10-16

## Contexto

O app precisa de uma rede para transportar e guardar temporariamente as mensagens cifradas, sem servidor pago pelo projeto e sem dono central ([Visão](../01-visao.md), princípios 1–3). A escolha precisa atender:

**Requisitos do modelo de ameaças** ([02](../02-modelo-de-ameacas.md#requisitos-para-o-protocolo-entrada-para-o-adr-0001)):

| # | Requisito |
|---|---|
| P1 | Criptografia ponta a ponta do conteúdo, com padding |
| P2 | Vários relays/servidores independentes, sem dono central |
| P3 | Armazenamento temporário para destinatário offline (meta: 7 dias, RNF-31) |
| P4 | Preferencialmente ocultar o remetente dos relays |
| P5 | Caminho conhecido para forward secrecy |
| P6 | Identidade derivável de uma frase de recuperação |
| P7 | Armazenar dados cifrados do próprio usuário (backup) |
| P8 | Suporte a prova de trabalho ou limite de taxa |
| P9 | Baixo consumo de dados e bateria |

**Restrições adicionais** ([03](../03-requisitos-funcionais.md), [04](../04-requisitos-nao-funcionais.md)):

| # | Restrição |
|---|---|
| C1 | MVP é um **PWA**: precisa de biblioteca madura em JavaScript/TypeScript, leve (código < 500 KB, RNF-16) |
| C2 | Custo zero de infraestrutura para o projeto |
| C3 | Voluntários brasileiros precisam conseguir rodar servidores com facilidade e baixo custo (soberania) |
| C4 | Grupos pequenos no MVP (RF-30) |
| C5 | Interoperabilidade com outros apps é desejável (princípio 6) |
| C6 | Usar criptografia conhecida e auditada (RNF-44) |

## Opções consideradas

### Opção A — Nostr (NIP-17 + NIP-44 + NIP-59)

Mensagens privadas são cifradas com NIP-44, "seladas" com a chave do remetente e embrulhadas (*gift wrap*, NIP-59) com uma chave descartável. São publicadas nos relays que o destinatário anunciou (lista kind 10050).

- **Prós:**
  - P1 ✅ NIP-44 já inclui padding. P2 ✅ centenas de relays públicos independentes. P4 ✅ o gift wrap esconde o remetente do relay. P6 ✅ NIP-06 deriva a chave de uma frase BIP-39. P7 ✅ dados do app cifrados nos relays (NIP-78/NIP-51). P8 ✅ prova de trabalho padronizada (NIP-13).
  - C1 ✅ `nostr-tools` é madura e leve. C3 ✅ relays são simples de rodar (strfry, nostr-rs-relay, khatru), até num computador pequeno. C5 ✅ outros apps já falam NIP-17 (0xchat, Amethyst etc.).
  - Grupos pequenos (C4): o NIP-17 já suporta conversas com vários participantes, embrulhando a mensagem uma vez para cada membro.
- **Contras:**
  - P5 ⚠️ Sem forward secrecy nas DMs. O caminho existe (**Marmot**, MLS sobre Nostr, com forward secrecy e recuperação pós-comprometimento), mas está **pré-1.0**: a especificação v2 tem mudanças incompatíveis em andamento e as bibliotecas estão em estágio inicial.
  - P3 ⚠️ Retenção depende de cada relay; não há garantia de 7 dias. É preciso escolher (ou operar) relays com política conhecida.
  - Metadados: o relay vê o **destinatário** (tag `p` do gift wrap) e, se exigir autenticação (NIP-42) para ler, liga IP e chave pública. Aceito no [02](../02-modelo-de-ameacas.md).
  - NIP-17 ainda é marcado como *draft* e o suporte a gift wraps (kind 1059) varia entre relays.
  - Grupos no NIP-17 são definidos pelo conjunto de participantes: mudar membros cria, na prática, uma "sala" nova. Administração de grupo (RF-31) precisa de convenção própria por cima.
  - Mídia não cabe nos relays (limite típico de 64–128 KB por evento): precisa de servidores **Blossom** separados, outra peça a operar.
  - P9 ⚠️ JSON e base64 adicionam peso; num grupo de 30 pessoas, cada mensagem de texto vira ~30 embrulhos (~45 KB de envio).

### Opção B — SimpleX (protocolo SMP)

- **Prós:** P1 ✅, P4 ✅✅ (sem ID de usuário, filas unidirecionais), P5 ✅ Double Ratchet desde já, privacidade de metadados de referência. Servidores auto-hospedáveis (C3 ✅).
- **Contras:**
  - C1 ❌ O núcleo é em Haskell; não há biblioteca JavaScript para construir um PWA. Seria preciso reimplementar o protocolo, que é complexo.
  - C5 ❌ Interopera só com o próprio app SimpleX.
  - P6 ⚠️ Não há identidade a recuperar por frase: o modelo não tem identidade persistente, o que conflita com RF-05/RF-06.
  - UX de contatos só por link/QR (já previsto no MVP, mas sem caminho para nome de usuário).

### Opção C — Waku / Logos Messaging

- **Prós:** P2 ✅ rede P2P por gossip; P4 ✅ boa privacidade de metadados na rede; P8 ✅ RLN (limite de taxa criptográfico).
- **Contras:**
  - C1 ⚠️ O projeto foi rebatizado (Logos Messaging); o status atual do `js-waku` não é claro e o suporte mobile ainda é trabalho em andamento.
  - P3 ⚠️ Poucos nós de armazenamento (*store nodes*), em boa parte operados pela própria organização mantenedora: risco para "sem dono central" e para soberania.
  - P5/P1: criptografia de mensagens fica a cargo da aplicação; seria preciso montar a camada de chat por cima.
  - Ecossistema pequeno, pouca interoperabilidade de chat.

### Opção D — Matrix

- **Prós:** P5 ✅ Olm/Megolm; recursos ricos e padronizados (multi-dispositivo, edição, reações, push); federação madura; C3 ✅ servidores auto-hospedáveis.
- **Contras:**
  - C2 ❌ Cada usuário depende de um homeserver; servidores consomem recursos consideráveis. O padrão de fato (matrix.org) é um ponto central estrangeiro.
  - P4 ❌ O homeserver vê quem fala com quem e guarda o histórico.
  - C1 ⚠️ O SDK com criptografia (Rust compilado para WebAssembly) tem vários MB, muito acima da meta do PWA.

### Opção E — Protocolo próprio

- **Prós:** controle total; desenhado sob medida para o Brasil.
- **Contras:** C6 ❌ risco altíssimo de erros de criptografia; nenhuma rede existente (C2/P2 ❌ até que voluntários surjam); C5 ❌; anos de trabalho.

## Comparativo

| | Nostr | SimpleX | Waku | Matrix | Próprio |
|---|---|---|---|---|---|
| P1 Conteúdo cifrado + padding | ✅ | ✅ | ⚠️ por conta do app | ✅ | ? |
| P2 Sem dono central | ✅ | ✅ | ⚠️ | ⚠️ | ❌ inicialmente |
| P3 Offline 7 dias | ⚠️ depende do relay | ✅ | ⚠️ | ✅ | ? |
| P4 Remetente oculto | ✅ | ✅✅ | ✅ | ❌ | ? |
| P5 Forward secrecy | ⚠️ futuro (Marmot) | ✅ | ⚠️ | ✅ | ? |
| P6 Frase de recuperação | ✅ NIP-06 | ❌ | ⚠️ | ⚠️ | ? |
| P7 Backup cifrado | ✅ | ⚠️ | ⚠️ | ✅ | ? |
| P8 Antispam | ✅ NIP-13 | ✅ | ✅ RLN | ⚠️ | ? |
| P9 Dados/bateria | ⚠️ | ✅ | ⚠️ | ⚠️ | ? |
| C1 PWA viável | ✅ | ❌ | ⚠️ | ⚠️ | ⚠️ |
| C2 Custo zero | ✅ | ✅ | ✅ | ❌ | ❌ |
| C3 Voluntários BR | ✅ fácil | ✅ | ⚠️ | ⚠️ pesado | ❌ |
| C5 Interoperável | ✅ | ❌ | ❌ | ✅ | ❌ |

## Decisão

**Usar Nostr** (NIP-17/NIP-44/NIP-59 para mensagens, NIP-06 para a frase, NIP-13 para prova de trabalho, Blossom para mídia), com uma **camada de abstração** entre o app e a criptografia de mensagens, para permitir trocar o esquema por **Marmot (MLS)** quando ele amadurecer, trazendo forward secrecy para grupos e conversas 1:1.

É a única opção que atende ao mesmo tempo PWA viável (C1), custo zero (C2), voluntários brasileiros (C3) e interoperabilidade (C5). Os pontos fracos (forward secrecy, retenção, metadados do destinatário) já foram aceitos como riscos no modelo de ameaças.

## Consequências

- **Fica mais fácil:** começar rápido com bibliotecas maduras; voluntários rodarem relays; conversar com usuários de outros apps Nostr; recuperar a identidade pela frase.
- **Fica mais difícil / dívida assumida:**
  - Forward secrecy depende da maturidade do Marmot (acompanhar a especificação v2 e as auditorias).
  - Precisamos **curar uma lista de relays** que aceitem gift wraps e retenham por 7 dias, e incentivar relays brasileiros (Q8 da Visão).
  - Precisamos de servidores **Blossom** para mídia, também gratuitos ou comunitários.
  - Recursos próprios (figurinha sonora, estado de modo foco, confirmações, numeração para detectar perdas, administração de grupo) exigem **eventos próprios**, com *fallback* legível em outros apps. Não há padrão Nostr consolidado para confirmações de entrega.
  - Tamanho de grupo limitado pelo custo de embrulhar uma vez por membro (Q-F1).
- **Rever se:** o Marmot não amadurecer em ~12 meses; relays públicos passarem a recusar gift wraps em massa; ou o modelo de ameaças mudar (ex.: exigir ocultar o destinatário).

## Questões em aberto

| # | Questão |
|---|---|
| Q-D1 | ✅ Tamanho máximo de grupo no MVP: **20 membros**, para manter cada mensagem de texto abaixo de ~30 KB de envio |
| Q-D2 | Quais relays e servidores Blossom compõem a lista padrão do MVP (detalhado no [05](../05-arquitetura.md)) → ➡️ Encaminhada em [05](../05-arquitetura.md) (Q-R1) |
