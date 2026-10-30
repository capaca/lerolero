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

### Montar o ambiente

No macOS (com [Homebrew](https://brew.sh)) ou no Debian/Ubuntu (com `apt` e `sudo`), um comando instala tudo o que
falta e pode ser repetido sem risco:

```bash
scripts/preparar.sh
```

| Ferramenta | Para quê |
|---|---|
| git e [gh](https://cli.github.com) | Código e ciclo de PR e release (`scripts/situacao.sh`, `pr.sh`, `release.sh`) |
| [fnm](https://github.com/Schniz/fnm) e Node 24 | A versão vem do `.node-version`, a mesma da CI; o Node global do sistema não serve |
| pnpm 12, via corepack | A versão vem do `packageManager` do `package.json` |
| Google Chrome | Suíte e2e, que usa o Chrome instalado, com relays e Blossom locais (sem Docker) |
| Dependências do projeto | `pnpm install --frozen-lockfile` |

Duas coisas ficam com você, e o script avisa se faltarem:

- `gh auth login`, para entrar no GitHub.
- No perfil do shell, a linha abaixo, para ter `node` e `pnpm` no terminal (o script mostra a versão certa para o seu
  shell; no Linux ela vem com o `~/.local/bin` no `PATH`, onde o fnm fica). Os scripts em `scripts/` não precisam dela.

  ```bash
  eval "$(fnm env --use-on-cd --version-file-strategy=recursive --shell zsh)"
  ```

Para conferir, `scripts/verificar.sh check test build e2e` roda tudo como a CI.

Em outra distribuição Linux, instale as ferramentas da tabela e rode `corepack enable` e
`pnpm install --frozen-lockfile`. O Google só publica o Chrome para Linux em amd64; em ARM a suíte e2e não roda.

### Comandos

```bash
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
- No Linux, o script usa o primeiro IP de `hostname -I`. Se houver VPN ou contêiner, confira se é o do Wi-Fi.

Tudo entra na `main` por pull request, com testes unitários a cada commit e testes com a rede real pedidos por rótulo.
O app vai para o GitHub Pages só numa release ([ADR-0006](docs/adr/0006-fluxo-de-trabalho-e-releases.md)).

## Licença

[AGPL-3.0-or-later](LICENSE).
