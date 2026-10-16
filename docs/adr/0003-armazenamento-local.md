# ADR-0003: Armazenamento local

- **Status:** aceito
- **Data:** 2026-10-16

## Contexto

O app guarda tudo no aparelho: identidade, contatos, conversas, mensagens, mídia em cache, filas de envio e cursores de sincronização. O PWA precisa ser leve (RNF-16) e, na v1, o mesmo código roda no Android e no desktop.

## Opções consideradas

- **IndexedDB (via Dexie):** nativo do navegador, sem peso extra. Consultas menos poderosas que SQL.
- **SQLite em WebAssembly + SQLite nativo:** mesmo banco em todas as plataformas, consultas SQL; adiciona ~1 MB ao PWA.

## Decisão

**IndexedDB via Dexie** no MVP, acessado **somente** por uma interface de repositório do núcleo (ex.: `MessageRepository`, `ContactRepository`, `MediaCache`). Nenhum outro módulo acessa o banco diretamente.

## Consequências

- Sem custo de tamanho no PWA.
- A interface de repositório permite trocar por SQLite nativo no Android/desktop, se necessário, sem mudar o resto do núcleo.
- Busca em texto (RF-26, *Could*) é mais limitada no IndexedDB; pode exigir um índice próprio.
- Navegadores podem apagar dados de sites sob pressão de espaço: o PWA deve pedir armazenamento persistente (`navigator.storage.persist()`) e o backup (RF-06) mitiga a perda.
