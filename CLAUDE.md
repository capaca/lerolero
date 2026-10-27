# Lero-lero

Mensageiro descentralizado sobre Nostr (NIP-17/44/59), focado no Brasil, sem custo de infraestrutura, PWA primeiro.
No ar em https://capaca.github.io/lerolero/ (guia de teste em `/teste`, roteiro de aceite em `/teste/roteiro`).
A especificação está em `docs/` (índice em `docs/README.md`, ADRs em `docs/adr/`, roadmap em `docs/07-roadmap.md`)
e precisa acompanhar cada decisão: use a skill `registrar-decisao`.

## Ambiente

- Node 24 via fnm (o Node global do Homebrew não serve). Prefixe os comandos com
  `eval "$(fnm env --version-file-strategy=recursive --shell bash)" && fnm use`.
- pnpm 12 via corepack. `gh` já está logado.

## Comandos (na raiz)

- `scripts/verificar.sh [check] [test] [build] [e2e]`: roda como a CI e mostra só uma linha por etapa e os erros (log
  completo em `$TMPDIR/lerolero-verificar/`). Prefira este aos comandos abaixo, que imprimem muito.
- `pnpm check`: tsc + svelte-check (inclui o service worker). Um aviso no service worker é esperado.
- `pnpm test`: vitest. O core testa com `FakeRelay`/`FakeBlossom` (`packages/core/src/testing`).
- `BASE_PATH=/lerolero pnpm build`: build igual ao do GitHub Pages.
- Textos da interface (ADR-0008): em `packages/app/messages/pt-BR.json`, usados como `m.chave()` (Paraglide); nenhum
  texto fixo nos componentes; negrito, ícone ou link no meio da frase vão pelo componente `Rich`. O e2e `textos`
  confere todas as telas no build da pseudolíngua (`pnpm build:pseudo`, que o `verificar.sh build` já roda); tela
  nova entra nele.
- Suíte e2e (`packages/e2e`, Playwright no Chrome instalado, relays e Blossom locais): `scripts/verificar.sh build e2e`.
  Funcionalidade nova entra com o seu teste em `packages/e2e/testes/`.
- `pnpm test:rede` em `packages/core`: relays e Blossom reais (lento, só sob demanda).

## Estrutura

- `packages/core`: TypeScript sem interface. Cofre da identidade no Web Worker (`identity/vault.ts`; a chave privada
  nunca sai dele), armazenamento Dexie atrás de repositórios (`storage/`), rede (`net/`), sincronização (`sync/`),
  mídia/Blossom (`media/`), conversas (`conversations/`).
- `packages/app`: SvelteKit 3 estático (SPA). Imports via `#lib/...`; estado da sessão em `src/lib/session.svelte.ts`.
- `prototipos/`: pesquisas fora do workspace (usam npm). `prototipos/e2e-rascunho` tem os rascunhos em Puppeteer
  ainda não migrados para `packages/e2e`.
- Fluxo (ADR-0006 e 0007): push direto na `main` é bloqueado; tudo entra por PR com squash. `ci.yml` (tipos, testes,
  build) roda a cada commit; `testes-sob-demanda.yml` roda pelos rótulos `integration-tests` e `e2e-tests`; cada merge
  vai para a homologação (`homologacao.yml`, https://lerolero-app.github.io/lerolero/, outra origem e outra conta);
  só `release.yml` (manual, SemVer 0.x) publica no Pages da produção, e publica o commit que está na homologação.

## Convenções

- Código, comentários, textos da interface, commits e docs em português; nomes no código em inglês.
- Comentários curtos explicando o porquê, com o requisito ou a ameaça quando houver (ex.: `RF-80`, `T15`).
- Commits sem nenhuma linha de atribuição a IA.
- Bug encontrado vem antes de qualquer outra coisa, com teste de regressão.
- Para publicar, use a skill `publicar`; para conferir no navegador, `testar-no-navegador`.
