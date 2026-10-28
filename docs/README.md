# Especificação — Lero-lero

Para uma apresentação curta do projeto, veja o [README](../README.md) da raiz.

Lero-lero é um app de mensagens com criptografia ponta a ponta, para o público geral, sem infraestrutura paga pelo autor.

## Documentos

| # | Documento | Status |
|---|---|---|
| 01 | [Visão](01-visao.md) | ✅ aprovado |
| 02 | [Modelo de ameaças](02-modelo-de-ameacas.md) | ✅ aprovado |
| 03 | [Requisitos funcionais](03-requisitos-funcionais.md) | ✅ aprovado |
| 04 | [Requisitos não funcionais](04-requisitos-nao-funcionais.md) | ✅ aprovado |
| 05 | [Arquitetura](05-arquitetura.md) | ✅ aprovado |
| 06 | [Protocolo e dados](06-protocolo-e-dados.md) | ✅ aprovado |
| 07 | [Roadmap](07-roadmap.md) | ✅ aprovado |
| — | [Glossário](glossario.md) | ✅ aprovado |

Legenda: ⏳ pendente · ✏️ rascunho · 👀 em revisão · ✅ aprovado

## Decisões de arquitetura (ADRs)

Cada decisão relevante tem um ADR em [`adr/`](adr/), seguindo o [template](adr/0000-template.md).

| ADR | Título | Status |
|---|---|---|
| [0001](adr/0001-protocolo-de-transporte.md) | Protocolo de transporte (Nostr) | ✅ aceito |
| [0002](adr/0002-stack-do-cliente.md) | Stack do cliente (TypeScript + Svelte, Capacitor, Tauri) | ✅ aceito |
| [0003](adr/0003-armazenamento-local.md) | Armazenamento local (IndexedDB/Dexie) | ✅ aceito |
| [0004](adr/0004-midia.md) | Mídia (cifrada, Blossom, deduplicada) | ✅ aceito |
| [0005](adr/0005-notificacoes.md) | Notificações (UnifiedPush no Android) | ✅ aceito |
| [0006](adr/0006-fluxo-de-trabalho-e-releases.md) | Fluxo de trabalho e releases (PR, testes por rótulo, SemVer) | ✅ aceito |
| [0007](adr/0007-homologacao.md) | Homologação antes da produção (outra organização GitHub, a cada merge) | ✅ aceito |
| [0008](adr/0008-internacionalizacao.md) | Internacionalização (Paraglide JS, pt-BR como base) | ✅ aceito |
| [0009](adr/0009-protecao-e-recuperacao-da-conta.md) | Proteção e recuperação da conta em camadas (arquivo, gerenciador de senhas, passkey) | ✅ aceito |

## Estudos

Levantamentos que embasam decisões, com a data em que foram feitos.

| Estudo | Data |
|---|---|
| [Apps de mensagens brasileiros](estudos/apps-brasileiros.md) | 2026-10-22 |
| [Escala do WhatsApp × Lero-lero](estudos/escala-whatsapp.md) | 2026-10-28 |

## Processo

1. Para cada seção, uma rodada de perguntas e respostas.
2. Rascunho do documento a partir das respostas.
3. Revisão; o status só vira ✅ depois da aprovação.
4. O que não for resolvido vai para a seção **Questões em aberto** do próprio documento, sempre com um responsável.
