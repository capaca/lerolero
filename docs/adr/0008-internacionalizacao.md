# ADR-0008: Internacionalização (Paraglide JS)

- **Status:** aceito
- **Data:** 2026-10-27

## Contexto

O [RNF-71](../04-requisitos-nao-funcionais.md) pede todos os textos em arquivos de tradução, prontos para a comunidade
traduzir, e o RNF-72 pede datas e números no formato da língua. Hoje nada disso está cumprido. O português está escrito
direto nos componentes Svelte (~185 trechos de texto, ~17 `aria-label`/`placeholder` e ~54 textos em script, contados
em 2026-10-27), em `errors.ts` (`friendlyError`) e nos avisos de grupo, que o core monta (`describeNotice`). As datas
usam `pt-BR` fixo (`format.ts`, `Avatar`, `localeCompare`), o `app.html` tem `lang="pt-BR"` e os plurais são feitos à
mão (`=== 1 ? 'pessoa' : 'pessoas'`) em seis lugares. Cada tela nova acrescenta mais texto fixo, por isso a
internacionalização vem antes das telas do M3 ([roadmap](../07-roadmap.md), Q-I1).

O que o mecanismo precisa ter: pouco peso no PWA (RNF-16), tipos (chave que falta quebra o `pnpm check`), plurais
corretos em qualquer língua, um formato que tradutores e ferramentas de tradução leiam, e troca de língua **sem
recarregar** a página, porque recarregar tranca o cofre e pede o PIN de novo.

## Opções consideradas

### Opção A — Paraglide JS 2 (inlang)
- Prós: é um compilador. Cada texto vira uma função tipada (`m.cadastro_titulo()`, `m.pessoas({ count })`) e o build
  só leva os textos usados. Plurais pelo `Intl.PluralRules`. Mensagens em JSON por língua, que ferramentas de tradução
  comunitária leem. Escolha da língua por estratégias em ordem (`localStorage`, `preferredLanguage`, `baseLocale`).
  Mantido ativamente (2.29.2, publicado em 2026-10-26).
- Contras: dependência de build e um diretório `project.inlang`. O código gerado não é escrito por nós. Por padrão,
  `setLocale` recarrega a página; numa SPA como a nossa dá para evitar com `setLocale(l, { reload: false })`, desde que
  a interface seja redesenhada por conta própria (um `{#key}` no layout).

### Opção B — svelte-i18n
- Prós: conhecido, mensagens no formato ICU.
- Contras: sem versão nova desde 2024-10, feito com stores do Svelte 4, carrega o `intl-messageformat` inteiro em
  tempo de execução e não tem tipos nas chaves. **Descartado.**

### Opção C — Módulo próprio
- Prós: zero dependência. `pt-BR.ts` como base e as outras línguas com `satisfies` do mesmo tipo.
- Contras: reimplementa o que o Paraglide já faz (plurais, interpolação, escolha da língua). O teste de chave que falta
  e o formato para tradutores ficariam por nossa conta.

### Opção D — wuchale
- Prós: acha os textos sozinho no código Svelte, sem chaves.
- Contras: ainda na versão 0.26, com transformação implícita do código. É arriscado para a base de todas as telas.

## Decisão

**Paraglide JS 2**, escolhido pelo Pedro em 2026-10-27. Ele cumpre os quatro requisitos sem código nosso para manter.
Como fica:

- **Língua-base pt-BR**, a única de verdade por enquanto. A segunda língua entra quando alguém pedir (espanhol e inglês
  foram considerados e ficaram para depois).
- **Escolha da língua:** `localStorage` (o que a pessoa escolheu em Ajustes), depois `preferredLanguage`
  (`navigator.languages`) e por fim `baseLocale`. Nada na URL: o app é uma SPA, e os links de convite não mudam.
- **Troca sem recarregar:** `setLocale(l, { reload: false })` e o layout redesenhado com `{#key}` na língua, para não
  trancar o cofre.
- **O core não tem texto de interface:** devolve códigos e estruturas (como já fazem `GroupNotice` e os erros com
  `name`) e o app traduz. `describeNotice` passa para o app.
- **Mesma localidade em tudo:** o `lang` do HTML, o `Intl.DateTimeFormat`, o `localeCompare` e o `toLocaleUpperCase`
  usam a língua escolhida (RNF-72).
- **Teste com uma pseudolíngua** (só no teste e2e, nunca no build da produção): a interface inteira numa língua de
  mentira, com acentos e ~30% mais longa (`[Ĉàðàšţŕàŕ···]`). Texto que ficou fixo aparece sem os colchetes e o teste
  falha. O texto mais longo também mostra onde o layout quebra.
- **Extração por área**, começando pelo primeiro uso (cadastro, PIN, conversa). Entram também as mensagens que o app
  escreve em nome da pessoa (convite, avisos de grupo, "comentário"). O guia `/teste` e o roteiro de aceite ficam por
  último, porque são para os testadores daqui.

## Consequências

- Uma língua nova é um JSON a mais, e o `pnpm check` aponta a chave que falta.
- Os plurais deixam de ser feitos à mão.
- Mais uma dependência de build, e as chaves precisam de nome (convenção `area_assunto`, ex.: `cadastro_titulo`).
- A escolha da língua fica no `localStorage`, não no banco. Num aparelho novo vale a língua do navegador até a pessoa
  escolher de novo. Pode entrar no backup cifrado (RF-06) quando ele existir.
- As dependências de build pesam: o SDK do inlang traz SQLite em WebAssembly e ~120 pacotes ao lockfile. Nada disso
  vai para o celular; o app só leva as funções geradas em `src/lib/paraglide/` (fora do git, geradas pelo `pnpm check`
  e pelo build).
- O plugin do formato das mensagens é o pacote `@inlang/plugin-message-format`, instalado e travado pelo pnpm, e não
  baixado de um CDN a cada build, como o modelo do inlang sugere: menos uma porta de entrada para código de fora no build.
  Pelo mesmo motivo a versão do Paraglide respeita a idade mínima de publicação do pnpm (2.29.1, não a 2.29.2 do dia).
- A pseudolíngua é um segundo build (`pnpm build:pseudo`, em `build-pseudo/`, servido pelo e2e em `/lerolero-pseudo/`),
  gerado de `messages/pt-BR.json` por `scripts/pseudolingua.js`. O teste `textos.spec.ts` percorre as telas já
  extraídas e falha com o texto que ficou de fora. A CI de e2e e o `verificar.sh build` fazem os dois builds.
- Se o Paraglide parar de ser mantido, as mensagens em JSON e as chamadas `m.chave()` dão para trocar por um módulo
  próprio (opção C) sem mexer nos textos.
