---
name: fechar-ciclo
description: Fecha um ciclo de trabalho do Lero-lero depois do merge, deixando a próxima sessão pronta para começar do zero. Use quando um PR entrar na main, quando o Pedro disser "salva o status", "atualiza a memória", "vou limpar o contexto" ou antes de encerrar a sessão.
---

# Fechar o ciclo

A próxima sessão começa sem contexto: tudo o que ela precisa sai do `scripts/situacao.sh`, do repositório ou da
memória de status. Este passo garante que nada se perca e que a memória não cresça.

## 1. Homologação

PR que mudou o app (não só docs ou bastidores): rode `scripts/pr.sh homologacao`, passe o link ao Pedro e diga em
poucas linhas o que conferir no celular em https://lerolero-app.github.io/lerolero/.

## 2. Roadmap

Confira se o item concluído tem "✅ Feita em <data>" na "Ordem do restante do MVP" de `docs/07-roadmap.md` e se a
linha "Andamento" do marco está certa. Se faltou no PR, faça um PR só de docs com a skill `registrar-decisao`.

## 3. Memória de status

Arquivo: `chat-app-status.md` na memória do projeto. **Reescreva as seções no lugar; nunca acrescente um parágrafo
de histórico** (o histórico é o `git log` e o `docs/07`). Guarde só o que o `situacao.sh` e o repositório não mostram:

- **Waiting on Pedro:** validações na homologação, release pedida ou não, decisões em aberto que ele precisa tomar.
- **Due:** esperas com data absoluta.
- **Known flaky:** testes instáveis ainda sem causa (tire os resolvidos).
- **Gotchas:** armadilhas do código que custaram tempo e não estão nos docs nem num comentário.

Tire o que foi resolvido neste ciclo. Confira o tamanho com `wc -c` (até ~2 KB). Aprendeu algo sobre como o Pedro
quer trabalhar? Isso vai numa memória de feedback, não aqui. Mantenha a linha do `MEMORY.md` igual se o arquivo não
mudou de propósito.

## 4. Mensagem final

Em poucas linhas: o que entrou (PR e link), o que o Pedro precisa fazer (conferir na homologação, ligar o
auto-merge, decidir algo) e o próximo item que o `situacao.sh` aponta. Diga que o contexto pode ser limpo.
