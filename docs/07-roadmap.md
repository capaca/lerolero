# 07 — Roadmap

- **Status:** ✅ aprovado
- **Última atualização:** 2026-11-11

Aqui ficam o plano e o estado de cada item. Como cada coisa ficou pronta (escolhas, alternativas, bugs achados no
caminho) está no [histórico de entregas](historico.md).

## Onde estamos

- **Feito:** M0, M1, M2 e M3 inteiros; do M4,
  tudo menos a passkey, adiada para depois do beta.
- **Próximo:** o primeiro item sem "✅" na [ordem](#ordem-do-restante-do-mvp) abaixo (hoje, o item 28: a conversa longa no aparelho de referência).
- **Em produção:** https://capaca.github.io/lerolero/; homologação em https://lerolero-app.github.io/lerolero/.

## Premissas

- **Dedicação:** ~5 h por semana, com o Claude ajudando na implementação. As estimativas incluem o tempo de revisar,
  testar e entender o código, não só de escrevê-lo.
- **Estimativas em semanas de trabalho** (1 semana = ~5 h). São faixas, não promessas: revisar a cada marco
  concluído.
- **Lançamento em duas etapas:** beta fechado (o Pedro + 10–20 amigos e familiares) antes de abrir ao público.

## Marcos

| Marco | Estimativa | Situação |
|---|---|---|
| M0 Fundação | 3 sem | ✅ 2026-10-16 a 22 (retenção dos relays confirmada em 2026-10-29; medição no aparelho de referência em 2026-11-11) |
| M1 Conversas 1:1 | 8 sem | ✅ 2026-10-16 a 22 |
| M2 Mídia (e grupos, adiantados do M3) | 6 sem | ✅ 2026-10-22 a 27 |
| M3 Conversa do dia a dia | 6 sem | ✅ 2026-10-26 a 29; arquivos (item 18) e botão de emojis (item 19) feitos em 2026-11-02 |
| M4 Segurança e confiança | 4 sem | Pedidos, bloqueio, backup, prova de trabalho, detecção de perdas e arquivo e gerenciador de senhas feitos; passkey (item 15) adiada para depois do beta |
| M5 Polimento | 4 sem | Velocidade da suíte e2e (item 16) e aviso de versão (item 17) feitos; acessibilidade feita (item 22); linguagem simples feita (item 21); notificações feitas (item 25, v0.12.0, com o convite na tela inicial); a fazer: item 20 |
| Revisão de prontidão | — | Em andamento, antes do beta: item 23; decisões de domínio, dados de uso e servidor tomadas em 2026-11-05; riscos levantados em [08](08-prontidao.md), com P1 a P9 corrigidos em 2026-11-05; faltam o domínio, as sondas e o resumo técnico |
| Identidade visual e app nativo | — | Decididos em 2026-11-06 para antes do beta: identidade visual feita (item 26, 2026-11-06); a fazer: app nativo (item 27) |
| Beta fechado | 6 sem de uso | A fazer: item 24 |
| v1 Android + desktop | 26 sem | Depois do beta |

O ritmo real ficou muito acima das estimativas: de 16 a 22/10 saíram o equivalente a ~15 semanas delas. A projeção
original (MVP público no 3º trimestre de 2027, v1 no 1º de 2028) precisa ser refeita (Q-M1).

## Ordem do restante do MVP

<!-- Item concluído termina com "✅ Feita em <data>", e item adiado com "➡️ Adiada em <data>": `scripts/situacao.sh` aponta
o primeiro sem essas marcas como o próximo. Os números são citados em outros docs: não renumerar. -->

Repriorizada em 2026-10-22 pelo critério do Pedro: **uso no dia a dia**, o que faz um grupo de amigos usar o app em vez
do WhatsApp.

1. Suíte de testes de ponta a ponta na CI e homologação antes da produção (M2, [ADR-0007](adr/0007-homologacao.md)). ✅ Feita em 2026-10-22.
2. Internacionalização (M3, [ADR-0008](adr/0008-internacionalizacao.md)). ✅ Feita em 2026-10-27.
3. Fotos e encaminhar sem reenviar (M2). ✅ Feita em 2026-10-27.
4. Responder e reagir (M3). ✅ Feita em 2026-10-28.
5. Status de entrega e de leitura (M3). ✅ Feita em 2026-10-28.
6. Seleção de várias mensagens: favoritar, excluir, copiar e encaminhar (M3). ✅ Feita em 2026-10-28.
7. Etapa 3 de UX/UI: aviso de sem conexão, tamanho da letra, nível do microfone (M3). ✅ Feita em 2026-10-28.
8. Cartão de perfil privado com nome e foto (M3; Q-P5, RF-02). ✅ Feita em 2026-10-29.
9. Editar mensagem e mencionar com `@` (M3; RF-24, 35). ✅ Feita em 2026-10-29.
10. Backup cifrado de contatos, grupos, configurações e do perfil, sem as favoritas (M4; RF-06). ✅ Feita em 2026-10-29.
11. Prova de trabalho com "Possível spam" em Pedidos (M4; RF-90, T8). ✅ Feita em 2026-10-29.
12. Detecção de perdas (M4; RF-53): numeração por conversa, pedido de reenvio e prazo de 7 dias. ✅ Feita em 2026-10-29.
13. Guardar o código de recuperação em arquivo ou cartão (M4; D2 do [ADR-0009](adr/0009-protecao-e-recuperacao-da-conta.md), RF-09 a): compartilhar um arquivo autoexplicativo (explicação, link de restauração e as 12 palavras), imprimir o cartão, restaurar pelo arquivo ou pelo link, e a tela "Proteção da conta". Sem dependências; entra com e2e. ✅ Feita em 2026-10-29.
14. Frase no gerenciador de senhas (M4; D1, RF-09 b). **Começa por um protótipo que mede, no Motorola Edge 60 e num iPhone, se o navegador oferece "Salvar senha?" no PWA instalado**; o resultado decide se a camada entra. Protótipo ([prototipos/senha](../prototipos/senha/README.md)) medido em 2026-10-29: no Motorola, no PWA instalado, o Chrome oferece salvar e a frase volta inteira; **a D1 entra no Android**, salvando por `PasswordCredential` e, onde ele não existir, pelo formulário que some. No app: "Guardar no gerenciador de senhas" em "Proteção da conta" e em "Guarde seu código", e "Usar o código salvo no navegador" na restauração; e2e `protecao`. Falta: medir no iPhone, quando houver um aparelho. ✅ Feita em 2026-10-29.
15. Passkey (M4; C, RF-08): entrar com digital ou rosto e restaurar em aparelho novo, com o backup cifrado pela chave PRF nos relays. **Só depois da decisão do domínio (Q-N1).** ➡️ Adiada em 2026-10-29 para depois do beta: o Pedro preferiu seguir para o polimento; o domínio é decidido na revisão de prontidão (item 23).
16. Velocidade da suíte e2e (M5): sem esperas fixas grandes; ~4 min na CI com 2 workers, que deram o mesmo tempo que 4 com menos risco de falha sem bug. ✅ Feita em 2026-10-30.
17. Aviso de versão nova mais rápido (M5): procurar versão nova a cada poucos minutos com o app aberto, para as correções chegarem logo a quem testa o beta. O cache de até 10 minutos do Pages continua até haver domínio próprio (Q-N1). ✅ Feita em 2026-10-30: a cada 5 minutos, só com o app na tela.
18. Arquivos além de fotos e "Salvar" no aparelho (M3; RF-44, 45): PDF e outros tipos pelo caminho das fotos (cifra, Blossom, envio com repetição, hash único do RF-70, encaminhar sem reenviar), com balão de nome, tipo e tamanho e download sob demanda; "Salvar" no menu da mensagem para foto e arquivo. Limite de 20 MB, executáveis bloqueados nos dois lados (T22) e "Salvar" por sistema, decididos em 2026-10-30. ✅ Feita em 2026-11-02
19. Botão de emojis no campo de mensagem (M3; RF-29). Decidido em 2026-11-02: lista gerada do `emojibase-data` (pt) por um script só no desenvolvimento, sem tons de pele e sem os emojis novos demais para o Android antigo, baixada só quando o seletor abre; busca por nome em português, com os mais usados primeiro; o "+" do menu da mensagem abre o mesmo seletor. Rejeitadas: lista à mão (faltam emojis, busca pobre), componente pronto (peso, visual e textos dele, axe e pseudolíngua), seletor sem busca e manter os 48 fixos no menu. ✅ Feita em 2026-11-02
20. Medição no aparelho de referência (M0 e M5; Q-N4): o protótipo de medição, que decide o [ADR-0002](adr/0002-stack-do-cliente.md), as metas de desempenho e dados do [04](04-requisitos-nao-funcionais.md) e a prova de trabalho abaixo de 1 s. Decidido em 2026-11-11: o aparelho de referência passa a ser o Redmi Note 8 do Pedro (4 GB, Android 10), em vez de um de 2 GB. Medidos o protótipo e o app de verdade (`packages/e2e/medir-celular.ts`); a conversa longa ficou fora das metas (item 28) e a partida a frio fica para o app nativo (item 27). ✅ Feita em 2026-11-11
21. Revisão dos textos para linguagem simples (M5; RNF-64). ✅ Feita em 2026-11-02
22. Revisão de acessibilidade WCAG 2.2 AA com leitor de tela (M5; RNF-60..63): axe-core e alvos de 48 dp em todas as telas no e2e `textos`; TalkBack e fonte a 200% conferidos no celular. ✅ Feita em 2026-11-03
25. Notificações por Web Push no PWA (M5; RF-82, Q-M2, [ADR-0010](adr/0010-web-push-no-pwa.md)): decidido em 2026-11-04, antes do beta; o número 25 é para não renumerar os outros. Em três etapas, cada uma com o seu PR: (1) o repassador mínimo, sem estado, só para os serviços de push conhecidos e com limite de pedidos, no Cloudflare Workers gratuito (escolhido em 2026-11-04; feita em 2026-11-04, `packages/repassador`, 120 pedidos por minuto por IP e só as origens do app); (2) no core, chave VAPID por pessoa, inscrição no cartão de perfil, cifra do aviso (RFC 8291) e envio depois de cada mensagem (1:1, grupo, fila offline), com chaves novas ao bloquear (feita em 2026-11-04, `packages/core/src/push`, com até 3 aparelhos por conta); (3) no app, "Notificações" em Ajustes, o service worker que mostra "Mensagem de <nome>" e abre a conversa ao tocar, e o e2e (feita em 2026-11-04). ✅ Feita em 2026-11-04
26. Revisão da identidade visual e da UX (decidido em 2026-11-06, antes do beta): logo, ícone, cores, tipografia e tom, talvez o nome (Q4 da [Visão](01-visao.md)), e os fluxos que mudarem com isso. Vem antes do app nativo para que ele já nasça com a marca nova, sem refazer ícone, abertura e páginas de loja. Decidido em 2026-11-06: o nome fica (Q4); o tom é brincalhão e brasileiro; mudam o ícone (o balão genérico), as cores (o verde lembra demais o WhatsApp, e o Lero-lero não deve parecer um WhatsApp genérico) e a tipografia (a do sistema tem cara de protótipo), e as telas ganham ajustes pontuais. Em etapas, cada uma com o seu PR: (1) três direções visuais (cor, ícone, fonte) numa página de comparação para o Pedro escolher; (2) a direção escolhida no app: cores clara e escura com contraste AA (RNF-60), fonte embutida no app e não de CDN (privacidade e uso sem rede), ícone e manifesto; (3) os ajustes de UX, revisados com o Pedro no celular, um PR por fluxo. Etapas 1 e 2 feitas em 2026-11-06: cores do Calçadão (anil, pedra e areia), ícone do Maracujá recolorido (balão branco com "ll" inclinado) fonte Outfit, balão enviado em anil sólido, barra da conversa em pedra e ícones novos de gravar (onda de voz) e enviar (seta cheia); rejeitados o Fuxico e o Maracujá inteiro, e os ícones sem balão (detalhes no [histórico](historico.md)). Etapa 3 decidida em 2026-11-06, em três PRs: (a) barra em pedra em todas as telas e Favoritas e Ajustes direto na barra do início, sem o menu ⋮ (feita em 2026-11-06); (b) cadastro e PIN: boas-vindas com a marca e três promessas, passos com progresso e voltar, foto opcional no nome e um PIN por vez (feita em 2026-11-06); (c) Ajustes e proteção da conta: Ajustes em lista agrupada, com chaves de liga e desliga e o aviso "Proteger agora", e a proteção com o PIN que segue sozinho e as opções em lista, a mais fácil em destaque (feita em 2026-11-06). ✅ Feita em 2026-11-06
28. Conversa longa no aparelho de referência (M5; RNF-12 a 15, P17 do [08](08-prontidao.md)), achada na medição do item 20: com 2.000 mensagens, a rolagem cai para 31 a 36 fps e o celular recebe só ~3,6 mensagens por segundo com a conversa aberta. Vem antes do app nativo, que usa a mesma interface. Um PR por problema: (a) a conversa aberta deixa de recarregar inteira a cada mudança (P17); (b) rolagem a 60 fps com mais de 1.000 mensagens carregadas. Cada um conferido com o `medir-celular.ts`.
27. App nativo com Capacitor antes do beta (decidido em 2026-11-06; antes era da v1, [ADR-0002](adr/0002-stack-do-cliente.md)): notificações confiáveis (o aviso retido com o celular parado, Q-M2), instalar como app de verdade em vez de "Adicionar à tela inicial", recursos do aparelho (câmera na hora, chave no cofre do sistema, RF-07) e iPhone no beta. Começa pelo Android. Decidido em 2026-11-06 ([ADR-0011](adr/0011-app-android-nativo.md)): push pelo FCM (UnifiedPush depois), APK assinado no GitHub Releases (Play depois do beta) e interface embutida no APK. Em etapas, cada uma com o seu PR: (1) o esqueleto em `packages/android`, com o APK de teste gerado pela CI (feita em 2026-11-07, conferida pelo Pedro no celular); (2) o APK assinado na release, com aviso de versão nova no app (feita em 2026-11-07; falta o Pedro criar a chave com `packages/android/scripts/chave.sh` e conferir no celular a atualização da primeira release para a segunda; verificação de desenvolvedor do Google conferida em 2026-11-07: segue sem conta, que fica para antes da regra global de 2027, no item 23); (3) o push pelo FCM, pelo repassador: o app nativo entra como mais um dos até 3 aparelhos de aviso do cartão (kind `4445`), com um tipo novo para o token FCM, e em Ajustes deixa de dizer "Este navegador não mostra notificações" (visto pelo Pedro em 2026-11-07: na homologação, com a mesma conta no PWA e no nativo, só o PWA recebe o aviso); (4) câmera na hora e chave no cofre do sistema (RF-07); (5) o iPhone, se a Q-N9 for aceita. Falta decidir: o iPhone (conta da Apple, US$ 99/ano, para o TestFlight; Q-N9). Depende do item 26.
23. Revisão de prontidão para produção, com os seis temas, os [limites conhecidos](#limites-conhecidos) e a decisão do domínio (Q-N1). Decidido em 2026-11-05: `.com.br` comprado antes do beta (Q-N1), resumo técnico opt-in já no beta (Q-N6), sem servidor próprio no beta (Q-N7). Em etapas, cada uma com o seu PR: (1) as decisões (feita em 2026-11-05); (2) o domínio: o Pedro compra, o Pages e o repassador passam a atendê-lo e o endereço antigo avisa quem ainda está lá; (3) o levantamento dos riscos por tema, com mitigação ou aceite, e a correção dos críticos (levantamento feito em 2026-11-05, em [08](08-prontidao.md): 36 riscos; o Pedro escolheu corrigir antes do beta os oito de perda e de chave, P1 a P8, e a faixa de avisos de incidente, P9, cada um com o seu PR; os nove corrigidos em 2026-11-05); (4) as sondas sintéticas na CI e o painel de saúde dos relays e Blossom; (5) o resumo técnico opt-in; (6) antes da regra global de 2027, a conta completa no Android Developer Console (US$ 25 e documento do Pedro) e o registro do pacote com a chave do APK ([ADR-0011](adr/0011-app-android-nativo.md)).
24. Beta fechado.

Organizada em 2026-10-30 pelo Pedro: as funcionalidades novas (17 a 19) vêm antes das revisões, para que a medição,
a linguagem e a acessibilidade já as cubram; o polimento vem antes da prontidão. Os outros pedidos ficam fora da ordem
e voltam a ser avaliados com o retorno do beta. Em 2026-11-06 entraram, antes do beta e nesta ordem, a identidade
visual (26) e o app nativo (27). Em 2026-11-11 entrou a conversa longa (28), achada na medição do item 20, antes do
nativo, que usa a mesma interface.

## MVP (PWA) por marco

✅ feito · ⬜ a fazer · ➡️ mudou de marco

### M0 — Fundação

- ✅ Monorepo (`packages/core`, `packages/app`), TypeScript, Svelte, Vite, testes, CI, licença AGPL-3.0.
- ✅ PWA publicado no GitHub Pages.
- ✅ Lista padrão de relays e Blossom (Q-R1): retenção de 7 dias confirmada em 2026-10-29 para toda a lista, menos o
  Blossom cdn.hzrd149.com, trocado pelo blossom.jumble.social. Fica em aberto: relays no Brasil (Q-D2).
- ✅ Protótipo de medição (Q-N4): rodado num celular intermediário e, em 2026-11-11, no aparelho de referência (Redmi
  Note 8); o stack do [ADR-0002](adr/0002-stack-do-cliente.md) se sustenta.

**Pronto quando:** o PWA "vazio" abre no celular de referência; os testes rodam a cada commit; existe uma lista
inicial de pelo menos 5 relays compatíveis.

### M1 — Conversas 1:1

- ✅ Identidade: criação, frase de recuperação, PIN, restauração (RF-01, 03, 04, 05). Desde 2026-10-26 a frase é
  pedida ao ganhar o primeiro contato, não no cadastro (Q-U1).
- ✅ Contatos por QR e link de convite; nome local (RF-10, 11, 14).
- ✅ Texto via NIP-17; lista de conversas; não lidas (RF-20, 21).
- ✅ Motor de sincronização: cursor, margem de 2 dias, deduplicação, fila offline (RF-80, 81; RNF-30..35).
- ✅ Banco local (Dexie).

**Pronto quando:** duas pessoas em aparelhos diferentes criam a identidade, se adicionam por QR e trocam mensagens,
inclusive com um dos dois offline por um dia; restaurar a identidade num aparelho novo funciona.

### M2 — Mídia

- ✅ Áudio: gravação, envio na hora com repetição, reprodução 1x/1,5x/2x, pula o silêncio do começo (RF-40; Q-R2).
- ✅ Fotos: compressão, prévia leve, download sob demanda (RF-41, 71).
- ✅ Cifra e envio ao Blossom; deduplicação por hash; encaminhar sem reenviar (RF-42, 70).
- ✅ Apagar mensagens, áudios e fotos para mim e para todos (RF-25).
- ✅ Grupos de até 20 com administradores (RF-30..33), adiantados do M3.
- ✅ Suíte e2e na CI ([ADR-0006](adr/0006-fluxo-de-trabalho-e-releases.md)) e homologação
  ([ADR-0007](adr/0007-homologacao.md)).
- ✅ Etapas 1 e 2 de UX/UI (tela inicial e conversa).
- ➡️ Expiração de mídia e painel de armazenamento (RF-72, 73): v1. Cartão de perfil e etapa 3 de UX: M3.

**Pronto quando:** os critérios de aceite "Mídia salva uma vez" passam; 1 minuto de áudio fica em torno de 210 KB e
uma foto em até 200 KB.

### M3 — Conversa do dia a dia

- ✅ Internacionalização: textos fora do código, pt-BR como base (RNF-71, 72).
- ✅ Responder e reagir (RF-22, 23).
- ✅ Status de entrega e de leitura, leitura desativável (RF-50, 51).
- ✅ Seleção de várias mensagens e favoritas (RF-28).
- ✅ Etapa 3 de UX/UI: sem conexão, tamanho da letra (RNF-65), nível do microfone.
- ✅ Endereços de páginas viram links, com cuidado com desconhecidos (T9, T18).
- ✅ Excluir conversa.
- ✅ Cartão de perfil privado com nome e foto (Q-P5, RF-02).
- ✅ Editar mensagem (RF-24).
- ✅ Mencionar alguém no grupo com `@` (RF-35).
- ✅ Arquivos além de fotos e "Salvar" no aparelho (RF-44, 45). Item 18.
- ✅ Botão de emojis no campo de mensagem (RF-29). Item 19.

**Pronto quando:** um grupo de 5 pessoas conversa com respostas, reações e menções; os status aparecem corretamente;
dá para selecionar várias mensagens e agir de uma vez; os textos da interface estão fora do código, com português
como língua-base.

### M4 — Segurança e confiança

- ✅ Pedidos de mensagem e bloqueio, inclusive vindos de grupo, com Contatos em abas (RF-12, 13).
- ✅ Backup cifrado de perfil, contatos, grupos e ajustes (RF-06).
- ✅ Prova de trabalho (14 bits) e "Possível spam" em Pedidos (RF-90).
- ✅ Detecção de perdas: numeração, pedido de reenvio automático e prazo de 7 dias com "Reenviar" (RF-53).
- ✅ Proteção da conta pelo arquivo ou cartão de recuperação e tela "Proteção da conta" (RF-09 a, D2 do
  [ADR-0009](adr/0009-protecao-e-recuperacao-da-conta.md)).
- ✅ Proteção da conta pelo gerenciador de senhas (RF-09 b, D1). Item 14; falta medir no iPhone.
- ⬜ Proteção da conta pela passkey (RF-08). Item 15.
- ➡️ Modo foco (RF-52, 60..62) e entrega em lotes (RF-63): v1.

**Pronto quando:** o critério de aceite "Perda de identidade" passa; a prova de trabalho leva menos de 1 s no aparelho
de referência; uma mensagem apagada propositalmente de um relay de teste é detectada e reenviada.

### M5 — Polimento

- ✅ Velocidade da suíte e2e (medida em 2026-10-26: ~99 s na CI com 2 workers). Caminhos, do que mais rende: subir os
  workers da CI para 3 ou 4, repetindo a suíte antes de adotar (a carga já expôs corridas); encurtar o
  `envio-sem-rede` (35 s, o mais longo); dividir em dois jobs (`--shard`). Item 16, feito em 2026-10-30.
- ✅ Aviso de versão nova mais rápido (2026-10-30). Item 17.
- ✅ Medição de todas as metas de desempenho e dados no aparelho de referência (seções 2 e 3 do
  [04](04-requisitos-nao-funcionais.md)). Item 20, feito em 2026-11-11.
- ⬜ Conversa longa dentro das metas (RNF-12 a 15). Item 28.
- ✅ Revisão de textos para linguagem simples (RNF-64). Item 21, feito em 2026-11-02.
- ✅ Revisão de acessibilidade WCAG 2.2 AA com leitor de tela (RNF-60..63). Item 22, feito em 2026-11-03.
- ✅ Notificações por Web Push no PWA (RF-82, [ADR-0010](adr/0010-web-push-no-pwa.md)). Item 25, feito em 2026-11-04 em três etapas: repassador, core (cifra, cartão, até 3 aparelhos, envio) e app (Ajustes, service worker).
- ⬜ Correção dos problemas encontrados; *Could* (RF-02, 26) só se sobrar tempo.

**Pronto quando:** as metas de desempenho são atingidas ou têm justificativa documentada; o fluxo de primeiro uso leva
menos de 2 minutos com uma pessoa leiga.

### Revisão de prontidão para produção (antes do beta)

Revisão do app inteiro com olhar de operação. Como não há servidor do projeto, cada tema muda de foco:

| Tema | O que revisar |
|---|---|
| Confiabilidade | Entrega de mensagens de ponta a ponta (perdas, repetidas, ordem), fila offline, retenção real dos relays, comportamento com relays e servidores Blossom fora do ar |
| Escalabilidade | Limites e capacidade dos relays e servidores Blossom de terceiros (taxa de envio, tamanho, retenção); dependência de poucos operadores; desempenho do app com muitas conversas e mensagens no aparelho de referência |
| Resiliência | Recuperação de falhas: reconexão, troca de relays, lista padrão atualizável (RNF-36), dados locais apagados pelo navegador, restauração pela frase |
| Segurança | Auditoria externa da criptografia e do cofre; dependências e cadeia de suprimentos (npm, CI); política de segurança de conteúdo (CSP) do PWA; tratamento de dados vindos de fora; canal para relatar vulnerabilidades |
| Monitoramento | Sondas sintéticas (contas de teste trocando mensagens pela rede real, a partir da CI), painel de saúde dos relays e servidores Blossom, diagnóstico local enviado pela própria pessoa (Enviar comentário); resumo técnico opt-in (Q-N6, aprovada em 2026-11-05) |
| Lançamento e volta atrás | Processo de publicação, como reverter uma versão ruim (service worker, cache), migrações do banco local sem perder dados, comunicação de incidentes a quem usa |

**Pronto quando:** cada tema tem os riscos listados com mitigação ou aceite documentado, e os itens críticos estão
resolvidos.

### Beta fechado (~6 semanas de uso)

- 10–20 pessoas, incluindo pelo menos algumas idosas ou com pouca familiaridade digital (RNF-65).
- Canal simples de feedback (ex.: um grupo no próprio app). Decidido em 2026-11-07: o "Enviar comentário" continua
  indo para a conta pessoal do Pedro, que ele abre sempre (sem conta separada por ora), e a triagem
  não é pública por enquanto. Falta um canal fora da rede, para quando o app não abre ou os relays caíram (P8, P9 da
  [prontidão](08-prontidao.md)): **decidido em 2026-11-07, um e-mail do projeto**, o mesmo da chave Pix e do
  suporte, com um `mailto:` já preenchido com a versão e o navegador, também na tela de erro do P8. Rejeitado o Google
  Forms como canal de socorro: mandar print nele exige entrar com conta Google, e é mais um site estranho para quem
  tem pouca familiaridade digital. Pendente: o Pedro criar o endereço.
- Acompanhar: mensagens perdidas, dificuldades de cadastro, consumo de dados, travamentos.

**Pronto para o lançamento público quando:**
- nenhuma perda de mensagem sem detecção;
- todos os participantes conseguiram cadastrar, adicionar contatos e mandar áudio sem ajuda;
- orientação jurídica obtida (Q-N3);
- domínio próprio no ar (Q-N1, decidido em 2026-11-05), que destrava a passkey (item 15);
- guia publicado para voluntários rodarem relays e servidores Blossom (Q8 da Visão).

## Pedidos e ideias ainda fora da ordem

Registrados a pedido do Pedro; entram na ordem quando ele decidir.

- **Baixar a foto sozinha** (2026-10-28). A prévia de 96 px esticada no balão ainda fica borrada; o que resolve de vez
  é baixar a foto sem toque, como o WhatsApp, mas isso gasta dados e mostra o IP a quem não é contato (T7). Proposta:
  só de contatos aceitos e talvez só no Wi-Fi.
- ~~**Notificações no PWA por Web Push** (2026-11-02; Q-M2).~~ Entrou na ordem em 2026-11-04 como item 25 ([ADR-0010](adr/0010-web-push-no-pwa.md)); medições em [prototipos/push](../prototipos/push/README.md).
- **Câmera na hora** para fotos (hoje só a galeria).
- **Ajustar o recorte da foto de perfil** (RF-02; 2026-10-29). Hoje o app usa o quadrado do meio da foto escolhida.
  Tela para arrastar e aproximar antes de salvar, como no WhatsApp.
- **Qualidade do som do áudio** (2026-10-22 e 26). Opus a 28 kbps com supressão de ruído e cancelamento de eco do
  navegador: sem cortes, mas ainda "um pouco feio" em lugar barulhento. Testar, comparando gravações no Motorola do
  Pedro: subir a taxa (36 a 48 kbps); desligar o cancelamento de eco; modo de voz do Opus; RNNoise em WebAssembly
  (~150 KB a mais no app); conferir se grava em 48 kHz mono. Decidir pela escuta, não por número.
- **Favoritar ainda vale a pena?** (2026-10-29). As favoritas ficam só no aparelho e não entram no backup (RF-06,
  decidido em 2026-10-29), então somem na troca de celular. Rever se a função continua útil assim, se muda (ex.: só
  como atalho para achar a mensagem) ou se sai.
- **Backup completo e opcional na nuvem** (2026-10-29; para avaliar depois). Complementa o RF-06, que de propósito não
  leva mensagens, favoritas nem mídia: um arquivo cifrado com chave derivada da frase, guardado onde só a pessoa acessa.
  Proposta em duas etapas: (1) exportar e importar o arquivo em Ajustes, pelo menu de compartilhar (sem servidor nem
  login, funciona no PWA); (2) automático no Google Drive, que pede OAuth, domínio próprio (Q-N1) e revisão do Google,
  e combina mais com a v1 nativa (no iPhone, o iCloud não está aberto ao PWA). Decidir: mídia entra ou é opcional
  (tamanho), lembrete de salvar e como importar por cima de mensagens que já estão no aparelho.
- **Doação por Pix** (2026-11-07). Primeiro passo do modelo de sustentação (Q-N8): um "Apoie o Lero-lero" em Ajustes
  e no site, com a chave e o QR do Pix. A chave é o e-mail do projeto (decidido em 2026-11-07, o mesmo do suporte e
  dos comentários), nunca CPF nem celular, porque quem paga vê a chave. Numa conta de pessoa física, quem paga vê
  também o nome do titular e parte do CPF; uma conta de empresa mostraria o nome e o
  CNPJ dela (avaliar se valer a pena). O Pedro topa, mais adiante, serviços pagos opcionais em cima (ex.: endereço NIP-05,
  relay ou Blossom com mais espaço), sem trancar nada do núcleo. Zaps (Lightning) ficam de fora por ora: quase
  ninguém no público do app tem carteira.
- **Escolha da língua em Ajustes e manifesto do PWA traduzido**: quando houver a segunda língua.
- **Testes e2e que ficaram nos rascunhos** (`prototipos/e2e-rascunho`): extras da identidade e do PIN (bloquear,
  esqueci o PIN, limite de tentativas), o pedido de contato e a publicação por cima de um app antigo com o cache do
  Pages.

## Limites conhecidos

Aceitos por ora; cada um tem a origem no [histórico](historico.md).

- Fechar o app nos ~10 s em que o envio 1:1 busca os relays de alguém novo deixa a mensagem pendente sem entrada na
  fila. A mesma janela curta existe ao pôr avisos de grupo na fila.
- Um embrulho que abre mas sempre lança ao ser guardado (um bug com aquele conteúdo) segura o cursor daquele relay
  até o relay apagá-lo (7 dias): cada sincronização baixa de novo esse trecho, sem perder nada (P3 da
  [prontidão](08-prontidao.md)).
- `markDeleted` grava a conversa sem esperar a vez (`conversations/lock.ts`), por ser chamada de dentro de
  `storeIncoming`.
- A edição de uma mensagem não é reenviada: quem a recebe por um pedido de reenvio vê o texto original.
- Se um áudio tocava quando o envio dele terminou, o balão é recriado e a reprodução recomeça.
- Notificações com mais de um aparelho: ao bloquear alguém, só o aparelho onde se bloqueou troca as chaves de push; os
  outros continuam com as antigas, que o bloqueado conhece (o bloqueio não passa de um aparelho para o outro).
- Se a troca de inscrição ao bloquear falhar depois de cancelar a antiga, o aparelho fica sem aviso até a próxima
  abertura do app, que se inscreve de novo; até lá os contatos recebem 410 e param de mandar.
- O texto da notificação sai sempre em português: sem janela aberta, o service worker não sabe a língua escolhida.

## v1 — Android e desktop nativos (~26 semanas)

| Item | Requisitos |
|---|---|
| App Android com Capacitor; APK assinado no GitHub Releases ([ADR-0011](adr/0011-app-android-nativo.md); ➡️ adiantado para antes do beta em 2026-11-06, item 27) | RNF-02, 81 |
| Notificações com UnifiedPush (no Android nativo do beta, FCM primeiro: [ADR-0011](adr/0011-app-android-nativo.md)); decidir quem dispara o "acorde" ([ADR-0005](adr/0005-notificacoes.md)) | RF-82 |
| App desktop com Tauri: bandeja, conexão própria, notificações | RNF-03, 83 |
| Chave no cofre do sistema; PIN/biometria opcional | RF-07, RNF-42 |
| Figurinhas, incluindo a figurinha sonora (Q-F5, Q-P2) | RF-43 |
| Modos de banda | RF-74 |
| Modo foco: Reter (manual, por tempo, agendado, exceções) e estado "retida" (adiados do MVP em 2026-10-22); Pausar; aviso automático | RF-52, 60–62, 64, 65 |
| Entrega em lotes (adiada do MVP em 2026-10-22) | RF-63 |
| Expiração de mídia e painel de armazenamento (adiados do MVP em 2026-10-22) | RF-72, 73 |
| Mensagens temporárias | RF-27 |
| Builds reproduzíveis do APK | RNF-46 |

**Programa de relays brasileiros (em paralelo):** documentação, contato com comunidades de software livre,
universidades e coletivos; meta de N operadores brasileiros independentes (métrica da [Visão](01-visao.md)).

## Futuro (sem ordem definida)

- **Forward secrecy com Marmot (MLS)** — reavaliar ~12 meses após o ADR-0001 (out/2027).
- Grupos grandes (RF-34).
- Multi-dispositivo.
- Chamadas de voz e vídeo: viáveis sem mudar a arquitetura (WebRTC direto, sinalização por NIP-17 efêmero); pesam o
  servidor TURN, o IP exposto à outra ponta e o toque com o app fechado. Avaliação de 2026-10-28 no
  [histórico](historico.md).
- iOS; Google Play (Q-N2: depois do beta); notarização no macOS (Q-N5).
- Recuperação de conveniência: Pix e gov.br (Q-A7) e busca por CPF/Pix (RF-15).
- PIN forte opcional (passphrase de 4 palavras, cerca de 44 bits contra 20 do PIN de 6 dígitos) para fechar o T15 sem
  passkey; ideia registrada em 2026-10-28.
- Antigolpe: verificação de contato, alerta de chave nova, alertas locais (RF-16, Q-A4).
- Denúncia e listas de bloqueio compartilhadas (RF-17).
- Resumo periódico (RF-66); vídeos.

## Escala e infraestrutura própria (registrado em 2026-10-28; nada decidido nem iniciado)

Vem do [estudo de escala](estudos/escala-whatsapp.md). Só entra na ordem do trabalho depois que o Pedro decidir
a Q-N7 (custo zero × servidor de referência) e a Q-N8 (teto de usuários); as prioridades são as do estudo.

| Prio | Item | Servidor / efeito |
|---|---|---|
| P1 (antes do lançamento público) | Sondas sintéticas na CI: entrega, latência e retenção a cada hora nos relays e Blossom da lista; fecha a Q-R1 | observabilidade |
| P1 | Relay e Blossom de referência próprios, com o "kit do operador" (imagem Docker + guia), ligado ao programa de relays brasileiros | relay + mídia |
| P1 | Medir o custo de sincronização (KB por abertura com 0, 50 e 500 mensagens; hipótese: ~170 KB contra a meta de 50 KB do RNF-20) e pôr o RNF-20 como teste na CI | cliente |
| P1 | Mídia em espelho (2 servidores) e expiração visível ("arquivo expirado") | mídia |
| P2 (antes de ~100 mil) | Sorteio dos relays de cada pessoa a partir da lista; Negentropy (NIP-77) na sincronização; PWA no Cloudflare Pages ou cache garantido; prova de trabalho (RF-90); limites e limpeza de mídia | relays, estático, cliente |
| P2 | Gateway de push sem conteúdo (Web Push) e aditivo no [ADR-0005](adr/0005-notificacoes.md) sobre custo em escala | push |
| P3 | Chamadas de áudio 1:1 com STUN público e TURN (`coturn`) | TURN |
| P3 | Marmot/MLS e canais (grupos acima de 20); multi-dispositivo; chamada em grupo com SFU | SFU, cliente |
| P3 | Modelo de sustentação (Q-N8); a doação por Pix já está nos pedidos fora da ordem (2026-11-07) | — |

## Pontos de decisão

| Quando | Decisão |
|---|---|
| Fim do M0 | ✅ O desempenho medido no aparelho de referência confirma PWA + Svelte? Sim, medido em 2026-11-11; a conversa longa é corrigida no item 28, sem mudar o [ADR-0002](adr/0002-stack-do-cliente.md) |
| Fim do beta | Lançar publicamente ou fazer mais uma rodada de correções |
| Início da v1 | ~~Quem dispara o push no Android~~ (no beta, o app do remetente pelo FCM, [ADR-0011](adr/0011-app-android-nativo.md)); Capacitor ou Tauri 2 para Android |
| Out/2027 | Marmot está maduro o suficiente para forward secrecy? ([ADR-0001](adr/0001-protocolo-de-transporte.md)) |

## Questões em aberto

| # | Questão | Responsável |
|---|---|---|
| Q-M1 | Refazer as estimativas e a projeção de datas com base no ritmo real | Pedro |
| Q-M2 | ✅ Notificações antes do beta? Decidido em 2026-11-04, sem o teste da noite: **Web Push no PWA com um repassador mínimo** ([ADR-0010](adr/0010-web-push-no-pwa.md), item 25), aceitando que, com o celular parado, o aviso fique retido até o desbloqueio (medido no Motorola, mesmo com `Urgency: high`). Rejeitados: nada antes do beta (depender de lembrar de abrir o app) e o app nativo com FCM (~2 semanas, gateway com credencial do Firebase, APK ou Play Store, duas versões). Medições em [prototipos/push](../prototipos/push/README.md) | Pedro |
| Q-N9 | iPhone nativo no beta (item 27): pagar a conta de desenvolvedor da Apple (US$ 99/ano) para o TestFlight, contra o orçamento zero (Q3 da Visão), ou deixar o iPhone no PWA. Decidir com o Android nativo pronto (2026-11-06) | Pedro |
| Q-N10 | ✅ Push no app nativo (item 27): FCM no Android e APNs no iPhone (funciona sem passo extra, mas passa pelo Google e pela Apple, como o Web Push de hoje) ou UnifiedPush, do [ADR-0005](adr/0005-notificacoes.md) (o testador instala o ntfy à parte). Decidir ao começar o item 27. **Decidido em 2026-11-06: FCM agora, UnifiedPush depois** como opção ([ADR-0011](adr/0011-app-android-nativo.md)); rejeitados só UnifiedPush (o ntfy à parte barra leigos) e os dois desde o início (trabalho) | Pedro |
| Q-U2 | Proteção da conta em camadas ([ADR-0009](adr/0009-protecao-e-recuperacao-da-conta.md)): ✅ o arquivo de recuperação fica em **texto aberto**, num `.txt` (decidido em 2026-10-29; ver a regra 4 do ADR). ✅ A D1 entra no Android (decidido em 2026-10-29, com a medição do protótipo `prototipos/senha` no Motorola: o aviso aparece no PWA instalado e a frase volta inteira), salvando por `PasswordCredential` e com o formulário que some de reserva (rejeitado: só o formulário, que depende de o navegador adivinhar o envio). Falta: medir no iPhone, quando houver um aparelho. | Pedro (ao implementar o item 14) |

Resolvidas: Q-I1 (internacionalização, 2026-10-27, [ADR-0008](adr/0008-internacionalizacao.md)) e Q-U1 (cadastro sem a
frase, 2026-10-26); detalhes no [histórico](historico.md).
