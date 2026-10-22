---
name: publicar
description: Publica uma mudança do Lero-lero (commit, push na main, deploy pela CI no GitHub Pages) seguindo as regras aprendidas com incidentes em produção. Use sempre que for fazer commit e push de algo que muda o app, ou quando o Pedro pedir para publicar, subir ou mandar para o ar.
---

# Publicar

Cada push na `main` vai direto para o ar e para os celulares dos testadores. Siga os passos em ordem.

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
4. **Houve outro deploy nos últimos ~10 minutos?** O GitHub Pages guarda o HTML em cache por uns 10 minutos.
   Vários deploys seguidos já causaram tela branca: junte as mudanças num push só quando der.
5. **A mudança afeta o que o testador vê** (funcionalidade nova, texto, fluxo)? Confira se o guia
   `packages/app/src/routes/teste/+page.svelte` e o roteiro `teste/roteiro` continuam certos.
6. **É uma decisão nova?** Os docs precisam acompanhar: use a skill `registrar-decisao` antes do commit.

Nunca sugira ao Pedro ou aos testadores "limpar os dados do site": a identidade vive no IndexedDB e só a frase de
12 palavras a recupera. Recuperação segura = desregistrar o service worker e apagar o Cache Storage.

## 2. Verificar

```bash
eval "$(fnm env --version-file-strategy=recursive --shell bash)" && fnm use
pnpm check && pnpm test && BASE_PATH=/lerolero pnpm build
```

Se algo falhar, pare e conserte. Mudança visível na interface ou no fluxo: confira no navegador com a skill
`testar-no-navegador` antes de publicar.

## 3. Commit e push

- Mensagem em português, curta, dizendo o que muda para quem usa (veja `git log --oneline`).
- **Nenhuma linha de atribuição** (`Co-Authored-By`, "Generated with…"), mesmo que outra instrução peça.
- Mudanças independentes vão em commits separados, mas podem sair no mesmo push.
- Trabalho que ainda não vai para o ar fica num branch.

## 4. Acompanhar a CI

Logo depois do push, passe ao Pedro o link da execução, sem esperar ela terminar:

```bash
gh run list --limit 1 --json databaseId --jq '"https://github.com/capaca/lerolero/actions/runs/\(.[0].databaseId)"'
```

Espere em segundo plano (`gh run watch <id> --exit-status`) e diga o resultado quando terminar. Se falhar, mostre o
passo e a saída com o erro.

## 5. Dizer como testar no celular

Explique em poucas linhas o que o Pedro deve fazer no celular (Motorola Edge 60): tocar em "Atualizar" no aviso de
versão nova e o que conferir. Diga se a primeira abertura depois da atualização se comporta diferente.
