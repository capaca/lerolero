# Protótipo de medição (M0)

Página que mede, no próprio aparelho, o que decide se o stack PWA + Svelte se sustenta ([ADR-0002](../../docs/adr/0002-stack-do-cliente.md), Q-N4):

| Teste | O que mede | Meta |
|---|---|---|
| NIP-17 | Cifrar (gift wrap para o destinatário e para si) e decifrar uma mensagem; tamanho do envelope | RNF-12, RNF-21 |
| Argon2id | Derivar a chave do PIN (19 MiB, 2 iterações), em WebAssembly (hash-wasm) e JS puro (@noble/hashes) | ~1 s (docs/06 §2) |
| Prova de trabalho | Tempo de NIP-13 por dificuldade, para calibrar Q-A1 | RNF-18 |
| Relays | Conexão, fim do histórico (EOSE), autenticação NIP-42 e ida e volta de um gift wrap | RNF-13 |
| Rolagem (`rolagem.html`) | Abrir uma conversa longa em Svelte e rolar o histórico, em cinco montagens da lista: simples, `content-visibility` por mensagem e em blocos de 50, janela de ~200 mensagens e virtualizada | RNF-11, RNF-14 |

Cripto, Argon2id e prova de trabalho rodam num Web Worker, como no app. O teste de ida e volta publica um gift wrap de teste nos relays, com chaves descartáveis.

A rolagem é automática (move `scrollTop` a cada quadro), então mede só a thread principal. A rolagem com o dedo roda em parte no compositor e tende a ser mais suave: o resultado é pessimista.

Não é código do app: é descartável e fica fora do monorepo.

## Rodar

```sh
npm ci
npm run dev       # abre na rede local (--host)
npm run build     # gera dist/
```

No celular, use a versão publicada no GitHub Pages (`/medicao/`): Web Crypto e service workers exigem HTTPS fora de `localhost`.

## Como medir

1. Feche os outros apps e deixe o aparelho na tomada (economia de bateria reduz a CPU).
2. Abra a página, toque em **Rodar tudo** e espere terminar (a prova de trabalho pode levar alguns minutos).
3. Toque em **Copiar resultados (JSON)** e cole o resultado no registro de medições.
4. Repita em Wi-Fi e em rede móvel.

Sem o aparelho de referência, dá para ter uma prévia no Chrome do computador: DevTools → Performance → CPU 6x mais lenta e rede "Slow 4G". Isso não substitui a medição no aparelho.

O TypeScript dentro dos arquivos `.svelte` não passa pela checagem de tipos: o `svelte-check` ainda não funciona com o TypeScript 7. Decidir isso no monorepo.
