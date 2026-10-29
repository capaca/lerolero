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
- O **título do PR vira o commit na `main` e a linha nas notas da release**, então escreva-o como os commits. Corpo
  (num arquivo no scratchpad): o que muda, como foi testado e o que conferir no celular.
- Rode a suíte antes, localmente: `scripts/verificar.sh build e2e`.
- Abra o PR, que já pede os testes sob demanda e imprime os links:

```bash
scripts/pr.sh abrir "<título>" <arquivo-do-corpo>
```

Passe ao Pedro, logo em seguida, o link do PR e os das execuções que o script mostrou.

## 4. Testes sob demanda e merge

- O merge exige `verificar` (tipos, testes unitários e build, a cada commit), `testes de integração` (relays reais) e
  `testes e2e`. PR só de documentação (`docs/` ou `.md`) dispensa os dois últimos; o script reconhece.
- Espere em segundo plano com `scripts/pr.sh esperar` (uma linha por check; se falhar, o passo e as linhas de erro)
  e diga o resultado.
- Commit novo no PR, ou falha por instabilidade de relay público: `scripts/pr.sh rotular`. Os rótulos só disparam
  num evento novo, e o script tira e põe de novo.
- Merge: quem faz é o Pedro (ou o auto-merge que ele liga). O merge vai para a homologação, não para a produção.

## 5. Homologação

O merge dispara `homologacao.yml`, que publica o app em https://lerolero-app.github.io/lerolero/ (ADR-0007): outra
origem, com moldura laranja "Homologação" e outra conta, sem tocar nos dados da produção. Rode
`scripts/pr.sh homologacao` (link da execução, espera e confere se o `commit.txt` é a ponta da `main`), passe o link
e diga o que conferir no celular nesse endereço. Mudança só de docs não vai para a homologação.

## 6. Release

Quando o Pedro pedir para publicar (ou juntar o que já entrou), rode `scripts/release.sh preparar`. A release
publica o commit que está na homologação, não o que estiver na `main` (ADR-0007); o script lista o que sai (da última
tag até a homologação), o que fica de fora e há quantos minutos foi a última release. Decida o tipo:

- **minor**: algum PR traz algo que o testador vê de novo (funcionalidade, tela, fluxo, texto que muda o uso);
- **patch**: só correções e ajustes que não mudam o que se faz no app;
- **nada a lançar**: só testes, docs ou bastidores (o script marca esses com `[sem release]`). Uma release pede ao
  testador para atualizar; não gaste à toa.

Mostre ao Pedro a lista com o tipo sugerido e o commit que vai sair, confirme que ele já o validou na homologação e
espere a confirmação. Só então, **numa chamada só para isso**, dispare (o script recusa se a última release foi há
menos de 10 minutos):

```bash
scripts/release.sh disparar minor   # ou patch; mostra o link da execução
```

Passe o link e, em outra chamada, em segundo plano, `scripts/release.sh acompanhar` (no fim mostra a versão e o link
da Release). O número da versão aparece em Ajustes.

## 7. Dizer como testar no celular

Explique em poucas linhas o que o Pedro deve fazer no celular (Motorola Edge 60): tocar em "Atualizar" no aviso de
versão nova, conferir em Ajustes se o número é o da release e o que testar. Diga se a primeira abertura depois da
atualização se comporta diferente.
