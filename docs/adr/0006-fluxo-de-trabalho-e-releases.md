# ADR-0006: Fluxo de trabalho e releases

- **Status:** aceito
- **Data:** 2026-10-22

## Contexto

Até aqui, cada push na `main` ia direto para o ar e para os celulares dos testadores. Deploys seguidos já causaram tela
branca (cache de ~10 minutos do GitHub Pages), e bugs chegaram ao celular antes de qualquer teste com a rede real. Com o
MVP repriorizado para o uso no dia a dia ([roadmap](../07-roadmap.md)), o Pedro quer branches aprovados antes do merge,
testes unitários a cada commit, testes de integração e e2e só quando pedidos (mas exigidos para o merge) e releases com
versão.

O repositório é pessoal e tem uma pessoa só. Isso muda duas coisas: o GitHub não deixa o autor aprovar o próprio PR, e
a fila de merge (merge queue) só existe em repositórios de organização.

## Opções consideradas

### Aprovação do PR
- **Revisão obrigatória (1 aprovação):** travaria todo merge, já que ninguém mais revisa.
- **Checagens obrigatórias, sem revisão:** "aprovado" = CI verde e testes de integração verdes no último commit.

### Disparo dos testes lentos
- **Rótulo no PR:** um clique, até pelo celular; fica na tela do PR.
- **Comentário `/testar`:** mais trabalhoso, porque o status precisa ser gravado à mão.
- **Workflow manual escolhendo o branch:** simples, mas fora do PR.
- **Fila de merge:** resolveria sozinha, mas não existe em repositório pessoal.

### Quando publicar
- **A cada merge na `main`:** como antes, só que via PR.
- **Só na release:** testadores recebem versões fechadas.

### Versão
- **SemVer 0.x** até o beta, ou **data (CalVer)**.

## Decisão

Escolhas do Pedro em 2026-10-22:

- **Push direto na `main` bloqueado para todos**, inclusive o dono (ruleset sem exceção). Merge só por PR, **squash**
  (cada PR vira um commit com o título do PR); o branch é apagado depois do merge.
- **Checagens obrigatórias:** `verificar` (tipos, testes unitários e build, a cada commit, em `ci.yml`),
  `testes de integração` e `testes e2e`. Sem revisão obrigatória. Desde 2026-11-06, `testes e2e` não é mais exigido
  (ver **E2E depois do merge**, abaixo).
- **Testes lentos por rótulo** (`testes-sob-demanda.yml`): `integration-tests` roda `pnpm test:rede` (relays e Blossom
  reais); `e2e-tests` roda a suíte e2e (`packages/e2e`, desde 2026-10-22) e o status `testes e2e` também é exigido para o
  merge (até 2026-11-06, ver abaixo). A suíte usa relays e Blossom locais (escolha do Pedro em 2026-10-22: rápida e sem falhas de relay público; a
  rede real fica com `integration-tests`). Rodar a suíte a cada commit foi descartado pelo Pedro: ela rodava uma vez, no
  último commit do PR, antes do merge. O resultado é um status gravado no commit pela API, e não o próprio job, porque um job pulado conta como
  aprovado para o GitHub. Um commit novo deixa o status pendente outra vez; o rótulo sai depois de cada rodada.
- **Mudança só de documentação** (`docs/` ou arquivos `.md`) dispensa os testes de integração e pula os passos do
  `verificar`. O job roda e termina verde, porque uma checagem obrigatória que não roda deixa o PR esperando para sempre.
  Desde 2026-10-28, mudança só de **bastidores** (`scripts/` e `.claude/` da raiz: scripts e skills do assistente, que
  não entram no app, no build nem nos testes) também dispensa os testes de integração e e2e e não vai para a
  homologação; o `verificar` continua rodando inteiro para ela. Antes, um PR só com um script novo rodava as duas suítes
  lentas e publicava a homologação sem mudar nada no app.
- **Deploy só na release** (`release.yml`, disparo manual na `main` escolhendo `patch`, `minor` ou `major`): calcula a
  versão a partir da última tag, verifica, monta o site, publica no Pages e só então cria a tag `vX.Y.Z` e a GitHub
  Release com as notas geradas dos PRs. Uma release por vez. Desde a [ADR-0007](0007-homologacao.md) (2026-10-22), cada
  merge vai antes para a homologação, e a release promove o commit validado lá.
- **SemVer 0.x** até o beta (minor = funcionalidade nova, patch = correção); a 1.0 marca a saída do beta. Regra
  detalhada em 2026-10-22 ([ADR-0007](0007-homologacao.md)): minor se algum PR desde a última tag traz algo que o
  testador vê de novo; patch se só correções; nada a lançar se só testes, docs ou bastidores. O número
  aparece em Ajustes e vai no "Enviar comentário". O `version` do SvelteKit continua sendo o do build e nomeia o cache do
  service worker.
- Tags `v*` não podem ser apagadas nem movidas.
- **E2E depois do merge** (decidido em 2026-11-06, a pedido do Pedro, trazido do Sonzeira): a suíte e2e passa para o
  `e2e.yml` e roda sozinha em cada push na `main` que mude `packages/app`, `packages/core`, `packages/e2e`, as
  dependências ou o próprio workflow; deixa de segurar o PR. Um merge novo cancela a rodada do anterior. O rótulo
  `e2e-tests` (`scripts/pr.sh e2e`) segue no PR para uma mudança arriscada, e o status que ele grava só informa.
  Motivo: em 64 rodadas, o e2e levou 5,7 min na mediana, repetido a cada commit novo do PR, e falhou 5 vezes, parte delas
  por teste instável; a CI normal leva 1,1 min. Antes do PR, roda localmente só o e2e da área mexida e o `textos`
  (`scripts/verificar.sh build e2e testes/<spec>.spec.ts`). Os **testes de integração** (36 s na mediana, nenhuma
  falha em 60 rodadas) continuam antes do merge e exigidos: conferem o protocolo contra relays de verdade, e consertar
  isso depois de chegar à homologação custaria mais. Em troca:
  - **vermelho na `main` é o primeiro item da próxima volta**, como um bug conhecido, antes do roadmap;
  - **nenhuma release sai de uma `main` vermelha**: como a release publica o commit da homologação (ADR-0007), e não a
    ponta da `main`, vale o e2e do último commit até ele que mexeu no que a suíte testa.

  **Travas, não só regras** (o Pedro: "é importante ter travas para a IA e para humanos"). Nenhuma depende de alguém
  lembrar:
  - o `e2e.yml` abre uma **issue com o rótulo `e2e-main`**, atribuída ao Pedro, quando falha na `main`; comenta nela
    nas falhas seguintes e a fecha quando a `main` volta a verde. O GitHub avisa o Pedro, e a issue é o item no backlog;
  - o `scripts/situacao.sh` mostra o último e2e da `main` e a issue aberta no começo de cada sessão;
  - o `scripts/pr.sh abrir` e `esperar` avisam quando a `main` está vermelha, mas não recusam, porque o conserto também
    entra por PR;
  - o `scripts/release.sh` e o próprio `release.yml` (para quem dispara pela página do Actions) **recusam a release**
    com a issue aberta ou com o e2e do commit da homologação sem estar verde, inclusive cancelado. Se não conseguem
    perguntar ao GitHub, recusam também. A consulta é uma só, em `scripts/e2e-main.sh`.

  Furos que sobram: o merge feito pela página do GitHub não passa por script (o aviso chega pela issue e pelo
  `situacao.sh`); cada merge vai para a homologação antes de o e2e terminar, e o Pedro pode conferir lá um commit que
  vai falhar (a trava barra a release, não a homologação); um teste instável abre a issue à toa (rodar de novo a fecha).
  Rever quando houver usuários reais na produção dependendo de releases frequentes, ou mais gente no projeto.

## Consequências

- Nada chega aos testadores sem passar por PR, CI e teste com a rede real, e os deploys ficam espaçados, o que evita a
  tela branca do cache do Pages.
- Mais passos para mudanças pequenas: branch, PR, rótulo, merge e release. Mudança só de docs fica barata.
- Correção urgente segue o mesmo caminho (PR + rótulo + release `patch`). Não há atalho de emergência; se fizer falta,
  rever o ruleset.
- O teste com a rede real depende dos relays públicos e pode falhar por instabilidade deles. Nesse caso, ponha o rótulo
  de novo.
- PRs vindos de forks não conseguem gravar status com o token padrão. Rever se houver contribuidores de fora.
