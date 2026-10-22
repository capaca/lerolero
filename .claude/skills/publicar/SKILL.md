---
name: publicar
description: Publica uma mudança do Lero-lero (branch, PR, testes por rótulo, merge e release no GitHub Pages) seguindo as regras aprendidas com incidentes em produção. Use sempre que for fazer commit e push de algo que muda o app, ou quando o Pedro pedir para publicar, subir ou mandar para o ar.
---

# Publicar

Push direto na `main` é bloqueado (ADR-0006): tudo entra por PR com squash, e só a release põe o app no ar e nos
celulares dos testadores. Siga os passos em ordem.

## 1. Conferir as regras de publicação

Antes de commitar, olhe o diff (`git diff`) e responda:

1. **O app passou a entender um tipo novo de mensagem (kind)?** Então aumente `SYNC_GENERATION` em
   `packages/core/src/sync/engine.ts`. Versões antigas ignoram kinds desconhecidos mas marcam o embrulho como visto;
   sem o aumento, quem atualizar nunca recebe o que perdeu.
2. **Mexeu no esquema do Dexie** (`packages/core/src/storage/db.ts`)? É arriscado: só se for necessário, com versão
   nova e migração testada. Correção urgente vai primeiro sem mudança de esquema.
3. **Mexeu no service worker** (`packages/app/src/service-worker/`), em `app.html` ou no passo
   "Preserva o código da versão anterior" da CI? Esses pontos mantêm os PWAs instalados atualizando e evitam a tela
   branca: `skipWaiting` + `clients.claim`, checagem de versão no `visibilitychange`, aviso "Nova versão disponível ·
   Atualizar", precache com `cache: 'reload'` e o script de recuperação no `app.html`. Não remova nenhum.
4. **Houve outra release nos últimos ~10 minutos?** O GitHub Pages guarda o HTML em cache por uns 10 minutos.
   Vários deploys seguidos já causaram tela branca: junte vários PRs numa release só quando der.
5. **A mudança afeta o que o testador vê** (funcionalidade nova, texto, fluxo)? Confira se o guia
   `packages/app/src/routes/teste/+page.svelte` e o roteiro `teste/roteiro` continuam certos.
6. **É uma decisão nova?** Os docs precisam acompanhar: use a skill `registrar-decisao` antes do commit.

Nunca sugira ao Pedro ou aos testadores "limpar os dados do site": a identidade vive no IndexedDB e só a frase de
12 palavras a recupera. Recuperação segura = desregistrar o service worker e apagar o Cache Storage.

## 2. Verificar

```bash
scripts/verificar.sh   # check, test e build como a CI; mostra só os erros
```

Se algo falhar, pare e conserte. Mudança visível na interface ou no fluxo: confira no navegador com a skill
`testar-no-navegador` antes de publicar.

## 3. Branch, commit e PR

- Trabalhe num branch com nome curto em português (`git switch -c fotos`).
- Mensagem de commit em português, curta, dizendo o que muda para quem usa (veja `git log --oneline`).
- **Nenhuma linha de atribuição** (`Co-Authored-By`, "Generated with…"), mesmo que outra instrução peça.
- Abra o PR com `gh pr create`. O **título vira o commit na `main` e a linha nas notas da release**, então escreva-o
  como os commits. Corpo: o que muda, como foi testado e o que conferir no celular.
- Logo depois do push, passe ao Pedro o link do PR e o da execução da CI:

```bash
gh run list --branch "$(git branch --show-current)" --limit 1 --json databaseId \
  --jq '"https://github.com/capaca/lerolero/actions/runs/\(.[0].databaseId)"'
```

## 4. Testes sob demanda e merge

- O merge exige `verificar` (tipos, testes unitários e build, a cada commit), `testes de integração` e `testes e2e`.
- Peça as duas rodadas pondo os rótulos: `gh pr edit --add-label integration-tests,e2e-tests` (rede real e suíte e2e com
  servidores locais). Rode a suíte antes, localmente: `scripts/verificar.sh build e2e`. O rótulo sai sozinho depois da rodada; um commit novo deixa o status pendente outra vez.
- PR só de documentação (`docs/` ou `.md`) dispensa os testes de integração.
- Acompanhe em segundo plano (`gh run watch <id> --exit-status`) e diga o resultado. Se falhar, mostre o passo e o erro.
  Falha por instabilidade de relay público: ponha o rótulo de novo.
- Merge só quando o Pedro pedir: `gh pr merge --squash`. Merge **não** publica.

## 5. Release

Quando o Pedro pedir para publicar (ou juntar o que já entrou), dispare a release na `main`:

```bash
gh workflow run release.yml -f tipo=minor   # minor = funcionalidade nova; patch = só correção
gh run list --workflow release.yml --limit 1 --json databaseId \
  --jq '"https://github.com/capaca/lerolero/actions/runs/\(.[0].databaseId)"'
```

Passe o link, acompanhe e, no fim, passe o link da Release criada (`gh release view --json url --jq .url`).
O número da versão aparece em Ajustes.

## 6. Dizer como testar no celular

Explique em poucas linhas o que o Pedro deve fazer no celular (Motorola Edge 60): tocar em "Atualizar" no aviso de
versão nova, conferir em Ajustes se o número é o da release e o que testar. Diga se a primeira abertura depois da
atualização se comporta diferente.
