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
- **Checagens obrigatórias:** `verificar` (tipos, testes unitários e build, a cada commit, em `ci.yml`) e
  `testes de integração`. Sem revisão obrigatória.
- **Testes lentos por rótulo** (`testes-sob-demanda.yml`): `integration-tests` roda `pnpm test:rede` (relays e Blossom
  reais); `e2e-tests` vai rodar a suíte e2e quando ela existir e, a partir daí, o status `testes e2e` também passa a ser
  exigido. O resultado é um status gravado no commit pela API, e não o próprio job, porque um job pulado conta como
  aprovado para o GitHub. Um commit novo deixa o status pendente outra vez; o rótulo sai depois de cada rodada.
- **Mudança só de documentação** (`docs/` ou arquivos `.md`) dispensa os testes de integração e pula os passos do
  `verificar`. O job roda e termina verde, porque uma checagem obrigatória que não roda deixa o PR esperando para sempre.
- **Deploy só na release** (`release.yml`, disparo manual na `main` escolhendo `patch`, `minor` ou `major`): calcula a
  versão a partir da última tag, verifica, monta o site, publica no Pages e só então cria a tag `vX.Y.Z` e a GitHub
  Release com as notas geradas dos PRs. Uma release por vez.
- **SemVer 0.x** até o beta (minor = funcionalidade nova, patch = correção); a 1.0 marca a saída do beta. O número
  aparece em Ajustes e vai no "Enviar comentário". O `version` do SvelteKit continua sendo o do build e nomeia o cache do
  service worker.
- Tags `v*` não podem ser apagadas nem movidas.

## Consequências

- Nada chega aos testadores sem passar por PR, CI e teste com a rede real, e os deploys ficam espaçados, o que evita a
  tela branca do cache do Pages.
- Mais passos para mudanças pequenas: branch, PR, rótulo, merge e release. Mudança só de docs fica barata.
- Correção urgente segue o mesmo caminho (PR + rótulo + release `patch`). Não há atalho de emergência; se fizer falta,
  rever o ruleset.
- O teste com a rede real depende dos relays públicos e pode falhar por instabilidade deles. Nesse caso, ponha o rótulo
  de novo.
- PRs vindos de forks não conseguem gravar status com o token padrão. Rever se houver contribuidores de fora.
