---
name: proximo-item
description: Começa o próximo trabalho do Lero-lero com pouco contexto, da situação do projeto até o PR. Use no começo de uma sessão, quando o Pedro disser "próximo item", "vamos para o próximo", "o que falta" ou pedir para seguir o roadmap.
---

# Próximo item

O ciclo é: situação → escolha do item → decisões → implementação → PR (skill `publicar`) → fechamento (skill
`fechar-ciclo`). Leia só o que o item pede; não leia o roadmap nem a memória de status inteiros.

## 1. Situação

```bash
scripts/situacao.sh
```

Antes de escolher um item novo, resolva o que já está andando, nesta ordem:

1. **Bug conhecido** (na memória de status ou relatado pelo Pedro): vem antes de tudo, com teste de regressão.
2. **PR aberto** com check falhando ou pendente: `scripts/pr.sh esperar <nº>` e conserte; rótulo de novo com
   `scripts/pr.sh rotular <nº>`.
3. **Alterações locais** ou branch à frente da `main`: pergunte ao Pedro se são desta sessão antes de mexer.
4. **Porta 4190 ou 5180 ocupada**: outra sessão está rodando; não rode o e2e nem o `celular.sh` até liberar.

Na `main` sem release não bloqueia: só mencione (a release é quando o Pedro pedir).

## 2. O item

O próximo é o primeiro da lista que o script mostra. Para entender o item, leia só o necessário:

```bash
grep -n "<palavra do item>" docs/07-roadmap.md docs/03-requisitos-funcionais.md | cut -c1-200
```

e abra as linhas achadas (com `offset`/`limit`), o RF citado e as questões em aberto ligadas a ele (Q-xx).

## 3. Decisões

Questão em aberto que muda o que vai ser feito: pergunte ao Pedro com `AskUserQuestion`, poucas perguntas objetivas,
com a opção recomendada primeiro. Registre a resposta com a skill `registrar-decisao` (data e porquê; opções
rejeitadas ficam como rejeitadas). Item grande: proponha etapas pequenas, cada uma com o seu PR.

## 4. Implementação

- Branch novo a partir da `main` atualizada: `git fetch -q origin && git switch -c <nome-curto> origin/main`.
- Siga o `CLAUDE.md`: textos em `pt-BR.json`, tela nova no e2e `textos`, funcionalidade nova com teste em
  `packages/e2e/testes/`, comentários curtos com o requisito.
- Verifique com `scripts/verificar.sh` e, mudando o app, `scripts/verificar.sh build e2e`.
- Ajuste de tela: suba `scripts/celular.sh` em segundo plano e revise com o Pedro no celular antes do PR.
- Se o PR conclui o item, marque-o no mesmo PR: na "Ordem do restante do MVP" de `docs/07-roadmap.md`, termine a
  linha com "✅ Feita em <data>" (é a marca que o `situacao.sh` procura), marque ✅ no marco e conte como ficou em `docs/historico.md`. Item feito
  em parte: escreva o que falta.

## 5. PR

Siga a skill `publicar`. Depois do merge, use a skill `fechar-ciclo`.
