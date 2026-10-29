---
name: registrar-decisao
description: Mantém a especificação do Lero-lero (docs/) em dia quando algo é decidido, mudado ou acrescentado ao plano. Use quando o Pedro tomar uma decisão, escolher uma opção, pedir para "acrescentar ao plano" ou "anotar", ou quando uma mudança no código altera um número, requisito ou risco descrito nos docs.
---

# Registrar decisão

Os docs são a fonte da verdade do projeto e precisam bater com o código e com o que o Pedro decidiu.

## "Acrescentar ao plano" = só registrar

Quando o Pedro pede para acrescentar algo ao plano ou anotar uma ideia, **não implemente**. Registre no
`docs/07-roadmap.md` (no marco certo como ⬜, ou em "Pedidos e ideias ainda fora da ordem"), e, se houver dúvida a resolver, nas **Questões em aberto** do documento
correspondente, sempre com um responsável.

## Onde cada coisa vai

| O que mudou | Onde registrar |
|---|---|
| Funcionalidade planejada, ordem do trabalho, andamento | `docs/07-roadmap.md`: uma linha por item, ⬜ ou ✅ no marco, "Situação" na tabela de marcos, "Limites conhecidos". Sem relatos |
| Como algo ficou pronto (escolhas, alternativas, bugs achados no caminho, o que ficou de fora) | `docs/historico.md`, na data da entrega, entrada mais recente no topo |
| O que o app faz | `docs/03-requisitos-funcionais.md` (RF-xx) |
| Metas de desempenho, dados, tamanho, acessibilidade | `docs/04-requisitos-nao-funcionais.md` (RNF-xx) |
| Risco novo ou risco aceito | `docs/02-modelo-de-ameacas.md` (tabela T-xx: ameaça, mitigação, quando) |
| Escolha técnica com alternativas (biblioteca, formato, parâmetro) | `docs/05-arquitetura.md` (questões Q-xx) ou um ADR novo |
| Formato de evento, tag, cifra, armazenamento | `docs/06-protocolo-e-dados.md` |
| Termo novo | `docs/glossario.md` |

Decisão grande, com alternativas que valem ser lembradas: ADR novo em `docs/adr/` a partir de `0000-template.md`,
com o número seguinte, e uma linha na tabela de `docs/README.md`.

## Como escrever

- Português simples, frases curtas, como o resto dos docs.
- Data absoluta (ex.: "decidido em 2026-10-22") e **por quê**, sobretudo quando algo foi rejeitado. Opções rejeitadas
  pelo Pedro ficam registradas como rejeitadas, para não serem propostas de novo.
- Mudou um número (taxa de áudio, prazo, limite)? Procure todos os lugares que o citam:
  `grep -rn "<número ou termo>" docs packages/*/src`. Também vale para comentários no código.
- Questão resolvida: marque com ✅ e a decisão, sem apagar o histórico.

## Antes de terminar

Confira com `git diff docs/` se nada ficou contraditório (ex.: o roadmap diz uma coisa e o requisito outra).
O commit dos docs pode ir junto com o código da mesma decisão.
