# Lero-lero

Mensageiro brasileiro, independente e descentralizado, com criptografia ponta a ponta.

- **Sem número de telefone:** a conta é criada no próprio celular e se recupera com uma frase de 12 palavras.
- **Ninguém é dono da rede**, nem o autor do app: as mensagens passam por servidores ([relays Nostr](https://nostr.com))
  mantidos por operadores independentes, e qualquer um pode trocar de servidor ou rodar o seu.
- **Custo zero de infraestrutura:** usa só servidores públicos e gratuitos; o app é um site estático.
- **Pensado para o Brasil:** celulares simples, internet ruim, pouca franquia, muito áudio e muitos grupos.

## Experimentar

O app está em teste e roda no navegador, e dá para instalar como app pelo menu do Chrome:
**https://capaca.github.io/lerolero/**

O [guia de teste](https://capaca.github.io/lerolero/teste) explica o que já funciona e como mandar comentários.
Ainda é uma versão de teste e não passou por auditoria de segurança: não use para assuntos sensíveis.

Já funciona: conta com PIN, contatos por QR ou link de convite, conversa de texto, áudio, apagar mensagens e grupos.
Os próximos passos estão no [roadmap](docs/07-roadmap.md).

## Como funciona

As mensagens são cifradas no aparelho e embrulhadas para esconder quem fala com quem
([NIP-17](https://github.com/nostr-protocol/nips/blob/master/17.md), [NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md),
[NIP-59](https://github.com/nostr-protocol/nips/blob/master/59.md)). Áudios vão cifrados para servidores
[Blossom](https://github.com/hzrd149/blossom). A chave privada fica num Web Worker e nunca sai dele.

A especificação completa (visão, modelo de ameaças, requisitos, arquitetura, protocolo e decisões) está em
[`docs/`](docs/README.md).

## Desenvolver

Requer Node 24 e pnpm 12 (via corepack).

```bash
pnpm install
pnpm check      # tipos (tsc + svelte-check)
pnpm test       # testes (vitest)
pnpm build      # site estático em packages/app/build
```

| Pasta | O que tem |
|---|---|
| `packages/core` | Núcleo em TypeScript, sem interface: identidade, armazenamento, rede, sincronização, mídia, conversas |
| `packages/app` | App em SvelteKit (PWA estático) |
| `prototipos/` | Pesquisas e medições feitas antes das decisões |
| `docs/` | Especificação e ADRs |

Cada push na `main` passa pela CI e é publicado no GitHub Pages.

## Licença

[AGPL-3.0-or-later](LICENSE).
