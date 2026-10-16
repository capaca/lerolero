# ADR-0002: Stack do cliente

- **Status:** aceito
- **Data:** 2026-10-16

## Contexto

O MVP é um PWA, e a v1 traz Android e desktop nativos reaproveitando o mesmo código (RNF-04). O app precisa ser leve (código < 500 KB, RNF-16) e rápido num Android de 2 GB (RNF-10..15). O autor tem familiaridade com TypeScript/JavaScript, Python e Go, e quer usar o projeto para aprender Rust.

## Opções consideradas

### Interface
- **Svelte/SvelteKit:** gera pouco código e é rápido; comunidade menor que a do React.
- **React:** maior ecossistema; pacote maior e mais cuidado com desempenho.
- **Preact / SolidJS:** leves, mas com ecossistemas menores ou compatibilidade parcial.

### Nativo
- **Android:** Capacitor (mesmo código web dentro de um app nativo) × reescrever em Kotlin.
- **Desktop:** **Tauri** (usa o navegador do sistema, código nativo em Rust, apps pequenos, versão 2 estável e ecossistema de plugins maduro) × Wails (mesmo modelo, código nativo em Go; a v3, que traz bandeja e notificações, ainda está em beta em outubro de 2026) × Electron (embute um Chromium inteiro, apps de 100+ MB).

## Decisão

- **TypeScript** em todo o código do app.
- **Svelte** (SvelteKit em modo estático/SPA) para a interface.
- **Núcleo em pacote separado** (`packages/core`), sem dependência de Svelte, testável isoladamente.
- **Vite** para build; **nostr-tools** e bibliotecas `@noble/*` (auditadas) para criptografia.
- **Capacitor** para Android e **Tauri 2** (Rust) para desktop, na v1. O Tauri tem bandeja do sistema, notificações e acesso ao cofre de chaves via plugins, necessários para a conexão própria do desktop ([ADR-0005](0005-notificacoes.md)).

## Consequências

- O PWA tende a ficar dentro da meta de tamanho.
- Um único código atende três plataformas; o que varia fica nos adaptadores de plataforma ([05](../05-arquitetura.md#adaptadores-de-plataforma)).
- Tauri usa Rust para o pouco código nativo do desktop (bandeja, cofre de chaves, notificações), o que é uma boa porta de entrada para o autor aprender Rust. A maior parte do app continua em TypeScript.
- O Tauri 2 também gera apps Android: no futuro, pode substituir o Capacitor e unificar as plataformas nativas numa só ferramenta.
- No macOS, notificações e distribuição sem avisos de segurança exigem app assinado e notarizado pela Apple (conta de desenvolvedor de US$ 99/ano), o que conflita com o orçamento zero. Vale para qualquer ferramenta de desktop ([Q-N5](../04-requisitos-nao-funcionais.md#questões-em-aberto)).
- Capacitor depende do WebView do Android; em aparelhos antigos com WebView desatualizado, o desempenho pode cair. Medir no aparelho de referência.
- Rever se o desempenho do Capacitor no aparelho de referência não atingir as metas: a alternativa é um app Android nativo em Kotlin reaproveitando só o núcleo.
