# ADR-0007: Homologação antes da produção

- **Status:** aceito
- **Data:** 2026-10-22

## Contexto

Desde a [ADR-0006](0006-fluxo-de-trabalho-e-releases.md), o merge na `main` não publica nada: só a release põe o app no
ar, direto para os celulares dos testadores. Entre o merge e a release não há onde conferir o app montado como no Pages,
no celular, com a rede real. A suíte e2e roda num Chrome de computador com servidores locais, e o que só aparece no
celular (teclado, PWA instalado, atualização pelo service worker) chega aos testadores sem ser visto antes.

O Pedro quer validar cada merge numa versão de homologação e só depois promover para a produção (2026-10-22).

O ponto delicado é a **origem**. O navegador separa IndexedDB, Cache Storage e permissões por origem (esquema +
domínio), não por pasta. Em `capaca.github.io/lerolero-homolog/`, a homologação dividiria com a produção, no mesmo
celular, o banco `lerolero`, onde ficam a identidade e as mensagens. Uma migração de esquema em teste mudaria o banco de
verdade (ver [ADR-0003](0003-armazenamento-local.md)).

## Opções consideradas

### Opção A — Outro repositório no Pages da mesma conta (`capaca.github.io/lerolero-homolog/`)
- Prós: nada novo para criar além do repositório.
- Contras: **mesma origem da produção**. Exigiria outro nome de banco e de cache no build da homologação; um nome
  esquecido mistura os dados do Pedro com os de teste.

### Opção B — Pages de outra organização GitHub (gratuita)
- Prós: origem separada, sem serviço novo. A organização pode ser a dona do domínio próprio quando ele vier (Q-N1).
- Contras: criar a organização e um token para publicar nela a partir deste repositório.

### Opção C — Cloudflare Pages
- Prós: origem separada (`*.pages.dev`) e um link de prévia por PR.
- Contras: mais um serviço e uma conta fora do GitHub.

### Opção D — Pasta `/lerolero/homolog/` no próprio site
- Contras: mesma origem, o service worker da produção cobre a pasta, e cada deploy da homologação republicaria a
  produção junto. Descartada.

### Quando atualizar
- **A cada merge na `main`**, automático.
- **Manual**, como a release.

## Decisão

Escolhas do Pedro em 2026-10-22:

- **Opção B:** a homologação fica no GitHub Pages da organização **`lerolero-app`** (criada pelo Pedro em 2026-10-22), no
  repositório `lerolero-app/lerolero`: https://lerolero-app.github.io/lerolero/, com origem própria e o mesmo caminho
  `/lerolero` da produção (o build é o mesmo). A opção A foi rejeitada pelo risco de misturar os dados; a C, por trazer mais um serviço.
- **Atualizada a cada merge na `main`** (`homologacao.yml`, que pula mudança só de docs): monta o app e publica no
  branch `gh-pages` de `lerolero-app/lerolero` com o secret `HOMOLOG_TOKEN` (token fine-grained, só Contents: write
  naquele repositório, validade de 1 ano). Grava o commit em `commit.txt`.
- **A release promove o commit validado:** lê o `commit.txt` da homologação, confere que ele está na `main` e publica
  na produção esse commit, e não o que estiver na `main` na hora. O fluxo fica: merge → homologação → o Pedro confere no celular → release.
- A homologação mantém a proteção contra a tela branca da produção (o código da versão anterior continua no ar) e se
  distingue dela: moldura laranja com a etiqueta "Homologação" (`APP_AMBIENTE=homologacao` no build), "· homologação"
  ao lado da versão em Ajustes, nome "Lero homolog" e cor laranja no PWA instalado.
- **Regra de versão da release** (ajuste à ADR-0006, mesma data): `minor` se algum PR desde a última tag traz algo que o
  testador vê de novo (funcionalidade, tela, fluxo); `patch` se só correções e ajustes; **nada a lançar** se só testes,
  docs ou bastidores. A skill `publicar` lista os PRs, sugere o tipo e o Pedro confirma.

## Consequências

- Cada mudança pode ser vista no celular antes de chegar aos testadores, com a rede real.
- Na homologação o Pedro tem uma segunda conta, separada da dele; os relays e os Blossom são os públicos, os mesmos da
  produção.
- Mais uma peça para manter: a organização, o token (com prazo de validade) e o workflow.
- Os deploys da homologação também caem no cache de ~10 minutos do Pages; merges seguidos podem demorar a aparecer.
- Com domínio próprio (Q-N1), rever: `homolog.<domínio>` na mesma organização.
- **Mudar a produção de endereço muda a origem:** se um dia a produção sair de `capaca.github.io` (para a organização
  ou para um domínio), cada pessoa começa do zero no endereço novo e precisa recuperar a conta com a frase de 12
  palavras; contatos e conversas ficam no endereço antigo. Planejar antes do beta, junto com a Q-N1.
