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

### Testar no celular durante o desenvolvimento

Mudança de tela se revisa no celular antes de abrir o PR: cada ajuste aparece na hora, sem esperar CI, homologação
e release a cada tentativa. Só a versão aprovada segue o fluxo normal.

```bash
scripts/celular.sh   # o app em dev na rede Wi-Fi, porta 5180; mostra o endereço e um QR
```

1. Celular e computador no mesmo Wi-Fi.
2. Na primeira vez, no Chrome do celular: abra `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, cole o
   endereço que o script mostrou (ex.: `http://192.168.0.10:5180`), escolha **Enabled** e toque em **Relaunch**.
   Sem isso o Chrome não trata o endereço como seguro e o cofre da identidade (Web Worker e criptografia) não
   funciona.
3. Abra o endereço (ou leia o QR). Ao salvar um arquivo, a tela do celular atualiza sozinha.

Bom saber:

- O app em dev fica numa origem própria: a conta criada ali é separada da conta da produção e da homologação.
- Em dev não há service worker, então não há cache antigo; o que depende dele (instalar, versão nova, uso
  sem internet) se confere na homologação.
- Se o IP do computador mudar, troque o endereço na flag. O script sempre mostra o atual.
- A porta 5180 não colide com a do e2e (4190), então dá para rodar os dois ao mesmo tempo.
- O script é para macOS (pega o IP com `ipconfig getifaddr`). Em outro sistema, rode
  `pnpm --filter @lerolero/app exec vite dev --host 0.0.0.0 --port 5180` e use o IP da máquina.

Tudo entra na `main` por pull request, com testes unitários a cada commit e testes com a rede real pedidos por rótulo.
O app vai para o GitHub Pages só numa release ([ADR-0006](docs/adr/0006-fluxo-de-trabalho-e-releases.md)).

## Licença

[AGPL-3.0-or-later](LICENSE).
