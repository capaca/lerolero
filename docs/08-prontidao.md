# 08 — Prontidão para produção

**Status:** ✏️ rascunho, levantamento de 2026-11-05 (item 23, etapa 3 do [roadmap](07-roadmap.md))

Os riscos do app inteiro antes do beta fechado, nos seis temas da revisão de prontidão. Cada um tem uma decisão:
**corrigir antes do beta**, **planejado** (com a etapa ou o item que resolve) ou **aceito no beta** (com o porquê).
A revisão está pronta quando os críticos estiverem corrigidos; cada correção entra com o seu teste de regressão e
marca a linha aqui com ✅ e a data.

O levantamento foi feito lendo o código em 2026-11-05 (commit `b6f7094`). As referências apontam onde o risco está
nesse commit. O que já estava em [Limites conhecidos](07-roadmap.md#limites-conhecidos) e nos riscos aceitos do
[modelo de ameaças](02-modelo-de-ameacas.md) não foi repetido, salvo quando o risco é maior do que lá está escrito.

Gravidade: **crítico** perde mensagem, contatos ou a conta sem aviso, expõe a chave ou deixa o app inutilizável;
**alto** atrapalha muito quem testa ou deixa o Pedro sem saída num incidente; **médio** e **baixo**, o resto.

## Decisões de 2026-11-05

- **Críticos:** o Pedro escolheu corrigir antes do beta os oito riscos de perda e de chave (P1 a P8). Rejeitados:
  incluir também os altos (atrasaria muito o beta) e corrigir só os de perda de mensagem (deixaria a chave exposta).
- **P6, decidido depois de analisado:** mover a sessão aberta para o cofre não impede um script na origem de levar a
  chave, porque ele abriria o mesmo banco do navegador e poderia capturar o PIN digitado. O Pedro escolheu fazer a
  mudança assim mesmo (a interface nunca mais vê a chave) e tirar o P6 dos críticos: a defesa contra script na origem
  é o P7 (sem código de terceiros na origem) e o P23 (CSP). A entrada sem PIN por 5 minutos continua (T16).
  Rejeitados: acabar com a entrada sem PIN, que pediria o PIN a cada recarga e ainda deixaria o PIN ao alcance do
  script; e só reclassificar, sem mudar o código.
- **Incidentes:** uma faixa de avisos no próprio app (P9), também antes do beta. Rejeitado por ora: um grupo de
  WhatsApp ou Telegram fora do app com quem testa.

## Corrigir antes do beta

| # | Tema | Risco | O que acontece | Onde | Correção |
|---|---|---|---|---|---|
| P1 | Confiabilidade, Segurança | Embrulho com horário no futuro trava o recebimento daquele relay | Qualquer um que saiba a npub (ou um relógio adiantado) publica um kind 1059 datado de 2030, mesmo inválido; o cursor vai para lá e, na próxima conexão, o relay não entrega mais nada guardado. Nos 3 relays de DM, a pessoa só recebe com o app aberto | `sync/engine.ts:190-194` | Cursor limitado ao relógio do aparelho; embrulho muito no futuro descartado sem mexer no cursor (T26). ✅ Feita em 2026-11-05: folga de 1 hora, e o cursor já guardado no futuro volta ao relógio ao abrir |
| P2 | Confiabilidade | O cursor avança antes de o histórico terminar | Os relays mandam o mais novo primeiro e o cursor grava o maior horário visto. Fechar o app (ou o iPhone suspender) no meio da sincronização pula o resto; na primeira sincronização (restauração, aparelho novo), o limite de resultados do relay corta o mais antigo | `sync/engine.ts:168-194` | Gravar o cursor só depois do EOSE; paginar com `until` quando chegar perto do limite. ✅ Feita em 2026-11-05: o cursor é gravado depois de processar todo o histórico, e o app pede sempre mais uma página com `until` (o limite de cada relay é desconhecido) |
| P3 | Confiabilidade | Embrulho marcado como visto mesmo quando falhou por motivo passageiro | Qualquer erro ao abrir ou guardar (cota cheia, worker, cofre trancado por "Bloquear" no meio da sincronização) descarta a mensagem para sempre. É o limite conhecido da falha de gravação, mais largo do que estava escrito | `sync/engine.ts:180-188`, `session.svelte.ts:349-354` | Marcar como visto só o embrulho inválido de verdade; `stop()` espera a fila de recebimento terminar. ✅ Feita em 2026-11-05: só o que não abre (`InvalidWrapError`) é descartado; com qualquer outro erro o embrulho fica para a próxima sincronização e o cursor daquele relay não passa dele. `stop()` espera até 5 s o embrulho em processamento e deixa o resto da fila |
| P4 | Confiabilidade | Mensagem que ficou dias na fila de saída não chega | O embrulho nasce na hora de escrever, com o horário recuado em até 2 dias (NIP-59), e sai da fila depois sem ser refeito. Quem recebe busca a partir de 2 dias antes do cursor: com 1 dia na fila, cerca de metade se perde; com mais de 2, quase todas. A pessoa vê "enviada". Confirmações, reações, avisos de grupo, apagar e editar não têm `seq` e nem o reenvio as recupera | `identity/vault.ts:336`, `sync/engine.ts:146-158, 170` | Embrulhar de novo, com horário novo, o item da fila mais velho que algumas horas (a fila passa a guardar o rumor). ✅ Feita em 2026-11-05: com 1 hora (2% de chance de cair antes da busca, contra metade com 1 dia), para todo embrulho, inclusive confirmações, reações, avisos de grupo, apagar, editar e a cópia dos meus aparelhos; com prova de trabalho se o original tinha. Itens que já estavam na fila antes da atualização saem como estão |
| P5 | Resiliência | Backup quase vazio substitui o bom | Na restauração, basta um relay responder "não há" (os de DM guardam só 7 dias) enquanto o que tem o backup demora; o app pede o nome e publica o backup deste aparelho, sem contatos nem grupos, por cima do bom (kind 30078 é substituível) | `backup/backup.ts:196`, `session.svelte.ts:478-543` | Só concluir "não há backup" com resposta dos três relays gerais; antes do primeiro backup publicado pelo aparelho, procurar de novo e, se o achado tem contatos ou grupos que o aparelho não tem, perguntar ("Trazer para este aparelho" ou "Descartar o backup antigo"). Decidido em 2026-11-05; rejeitados: só a primeira parte, juntar sozinho sem perguntar e o aviso por ter menos contatos que o último backup visto (quase nunca dispararia: o app só vê um backup quando já o juntou). ✅ Feita em 2026-11-05 |
| P6 | Segurança | A sessão aberta entrega a chave à thread principal | `openSession` devolve a chave AES (não exportável, mas utilizável) e a chave privada cifrada; a interface grava as duas no IndexedDB. Qualquer script na origem decifra a nsec. Quebra a regra de a chave nunca sair do cofre; o T16 só aceitava a cópia dos dados do disco | `identity/vault.ts:361-367`, `session.svelte.ts:246-256` | O worker grava e lê a sessão no IndexedDB sozinho; a interface só pede para retomar e recebe a chave pública. Sessão vencida apagada ao abrir. ✅ Feita em 2026-11-05: só o cofre grava, lê, renova e apaga a sessão, num banco próprio (`lerolero-sessao`); a sessão antiga, da interface, é apagada ao abrir. **Reclassificado** no mesmo dia: não é mais crítico, porque a mudança não fecha o risco (ver as decisões acima) |
| P7 | Segurança | Protótipos publicados na origem da produção | O release publica `prototipos/medicao` em `/medicao/`, com outro lockfile, `npm ci` com scripts de instalação e outras versões de Vite e Svelte. Uma dependência comprometida ali roda na origem do app e, por P6, leva a chave | `release.yml:76-88` | Só o app na origem da produção; os protótipos ficam na homologação. ✅ Feita em 2026-11-05: a release publica só o app; o protótipo de medição (item 20) passou para a homologação, em `/medicao/`, onde só há contas de teste. O `/medicao/` da produção some na próxima release |
| P8 | Lançamento | Tela branca para sempre se o banco falhar ao abrir | `session.init()` não trata erro: com a migração lançando, cota cheia ou banco corrompido, o status fica em "carregando" e nada aparece, sem mensagem nem "Enviar comentário". Os dados ficam intactos | `session.svelte.ts:233-238`, `+layout.svelte:60, 134` | Tela de erro com o texto do erro, a versão, "Tentar de novo" e o aviso do P9; nunca oferecer apagar dados. Com e2e |
| P9 | Lançamento, Monitoramento | Nenhum jeito de avisar quem testa sobre um incidente | Versão ruim ou relay fora do ar: o Pedro não tem como falar com todos. "Enviar comentário" vai pela própria rede, que pode ser o que quebrou | `lib/teste.ts:11`, `ajustes/comentario/+page.svelte:36` | Faixa de avisos lida de um `avisos.json` da rede, e um workflow que republica só os dados sem release nova (decidido em 2026-11-05) |

## Confiabilidade

| # | Risco | Gravidade | Decisão |
|---|---|---|---|
| P10 | **Conexão zumbi:** depois de trocar de Wi-Fi para 4G ou voltar do segundo plano, o socket fica aberto e morto; nada chega, os envios ficam "enviando" e o aviso de sem conexão não aparece. Não há ping; `reconnectNow` pula conexões dadas como abertas; tempo esgotado não derruba o socket (`net/pool.ts:176-183`, `net/connection.ts:204-211`) | Alto | Aceito no beta: a reconexão ao voltar a rede cobre o caso comum. É o primeiro a corrigir se aparecer (reabrir depois de ~30 s fora da tela) |
| P11 | **Assinatura encerrada pelo relay não é refeita:** com `CLOSED` (auth, limite, "restricted") a conexão continua e aquele relay para de entregar até o socket cair. O `auth.nostr1.com`, da lista padrão, exige auth (`net/connection.ts:173-183`, `sync/engine.ts:116`) | Médio | Aceito no beta; os outros 2 relays de DM entregam. Corrigir com P10 |
| P12 | **"Enviando" para sempre:** se todos os relays do contato recusam ou morreram, a fila tenta a cada 15 min sem fim e o balão não diz nada (`sync/engine.ts:226-231`, `conversations/losses.ts:133`) | Médio | Aceito no beta; depois, "não saiu" após algumas horas, buscando o 10050 de novo |
| P13 | **Duas abas ao mesmo tempo** (PWA e navegador, ou janela aberta pela notificação): cada uma sincroniza; o "visto" não é atômico entre elas, o que pode contar não lidas em dobro ou repetir o `seq` (`conversations/lock.ts`) | Baixo | Aceito no beta; depois, uma aba líder com `navigator.locks` |
| P14 | **Mídia antiga some:** a foto só baixa ao tocar, e a retenção dos servidores Blossom é desconhecida; encaminhar reaproveita o link antigo sem conferir (`conversations/messaging.ts:102-106`) | Médio | Aceito no beta; explicar no guia de teste que mídia antiga pode sumir |

## Escalabilidade

| # | Risco | Gravidade | Decisão |
|---|---|---|---|
| P15 | **Poucos operadores:** todo o beta usa os mesmos 3 relays de DM e 2 servidores Blossom; o `relay.nmail.li` está nas duas listas. Sem tratamento de `rate-limited`; depois do primeiro aceite a fila insiste só 3 vezes; uma mensagem de grupo de 20 gera até 60 publicações (`static/relays.json`, `sync/engine.ts:31, 215-233`) | Médio | Planejado: as sondas da etapa 4 mostram se faltar capacidade (Q-N7). 20 pessoas cabem |
| P16 | **Cache de mídia sem limite:** o índice `lastAccess` existe, mas nada apaga; com a cota cheia, cai no P3 (`storage/db.ts:46`, `storage/repositories.ts:180`) | Médio | Aceito no beta (RF-72 é da v1); o P3 evita perder mensagem quando encher |
| P17 | **A conversa aberta recarrega inteira a cada mudança em qualquer conversa**, com todas as reações e as citações uma a uma, sem virtualização (`components/Chat.svelte:41, 383-421`) | Médio | Aceito no beta; medir no aparelho de 2 GB (item 20) e corrigir com uma versão por conversa |
| P18 | **Favoritas percorre todas as mensagens** sem índice (`storage/repositories.ts:159`) | Baixo | Aceito no beta |
| P19 | **Cota do repassador:** a checagem de `Origin` se forja fora do navegador; 120 pedidos por minuto de um único IP passam dos 100 mil diários do plano gratuito e calam as notificações de todos até a virada do dia (`repassador/src/repassador.ts:111-124`) | Médio | Aceito no beta (T23: cai só o aviso, não a mensagem); baixar o limite e criar alerta de uso no Cloudflare |

## Resiliência

| # | Risco | Gravidade | Decisão |
|---|---|---|---|
| P20 | **A lista padrão atualizável não chega a quem já tem conta** (RNF-36): `meusRelaysDm` é escolhido uma vez; `dmReserva` é validado e não é usado. Se um relay de DM morrer, quem já tem conta continua nele (`session.svelte.ts:1227-1232`) | Alto | Aceito no beta, com o Pedro acompanhando os relays pelas sondas (etapa 4). Antes do lançamento: troca automática pela reserva, com 10050 e cartão novos |
| P21 | **Restauração escuta os relays de hoje, não os da conta:** sem rede na restauração, o app grava a lista padrão atual antes de achar o backup, e o backup não sobrescreve (`session.svelte.ts:403-410`, `backup/backup.ts:178-180`) | Alto, só se a lista padrão mudar | Aceito no beta: a lista não deve mudar durante ele. Corrigir junto com P20 |
| P22 | **Dados apagados pelo navegador levam a uma conta nova por engano:** o app abre em "Criar conta"; o resultado de `persist()` é gravado e nunca lido (`session.svelte.ts:177-182`) | Médio | Aceito no beta: o lembrete da frase e o roteiro de aceite cobrem. Depois, "Já usou o Lero-lero antes?" no cadastro |

## Segurança

| # | Risco | Gravidade | Decisão |
|---|---|---|---|
| P23 | **Sem CSP:** nenhum `<meta>` de CSP nem `kit.csp`; um script injetado roda e manda dados para qualquer lugar. Hoje não há `{@html}` com dado externo | Alto | Planejado logo depois dos críticos: `kit.csp` com hash do script inline do `app.html`, `script-src 'self'`, `object-src 'none'`, `base-uri 'none'`; `connect-src` aberto a `wss:` e `https:` (relays e Blossom são arbitrários) |
| P24 | **Actions fixadas por tag**, inclusive `pnpm/action-setup`, que roda no job que tem o `CLOUDFLARE_API_TOKEN` | Médio | Planejado com P23: fixar por SHA e Dependabot para `github-actions` |
| P25 | **Sem canal para relatar vulnerabilidades** (não há `SECURITY.md`) | Médio | Planejado com P23: `SECURITY.md` e o relato privado do GitHub ligado |
| P26 | **Dependências atualizadas à mão**, sem `pnpm audit` na CI | Baixo | Aceito no beta: poucas dependências de execução, versões exatas e lockfile congelado. Dependabot com P24 |
| P27 | **Download de mídia sem teto quando falta `Content-Length`:** `Number(null)` vale 0 e `arrayBuffer()` lê sem limite; gasta dados e memória (`media/blossom.ts:129-132`) | Médio | Planejado com P23: ler em partes e abortar acima do tamanho máximo |

## Monitoramento

| # | Risco | Gravidade | Decisão |
|---|---|---|---|
| P28 | **Erros em produção invisíveis:** sem captura de erros nem `+error.svelte`; "Enviar comentário" leva navegador, versão e relays conectados, mas não os últimos erros, a fila de saída, a versão do banco, o armazenamento persistido, a última sincronização por relay nem o estado do push (`ajustes/comentario/+page.svelte:20-28`) | Alto | Planejado na etapa 5: registro local dos últimos erros, que entra no comentário e no resumo opt-in, e pode ser copiado quando a rede falhar |
| P29 | **Falhas do repassador passam em silêncio:** o `PushNotifier` ignora qualquer erro e o Worker não guarda logs (`push/notifier.ts:78-86`) | Médio | Planejado na etapa 4: sonda no repassador e alerta de erros no painel do Cloudflare |
| P30 | **Sondas só por rótulo de PR** e a saúde dos relays anotada à mão em `relays.json` | Médio | Planejado na etapa 4, cobrindo também os relays de reserva, um relay com auth, a retenção (ler horas depois), o site no ar e o repassador, com alerta que chegue ao Pedro (issue ou e-mail). Workflows agendados param depois de 60 dias sem atividade no repositório |

## Lançamento e volta atrás

| # | Risco | Gravidade | Decisão |
|---|---|---|---|
| P31 | **Não há como voltar a uma versão:** o `release.yml` só publica o commit da homologação. O caminho improvisado (homologação na tag antiga e release `patch`) calcula a versão a partir do commit antigo, pode colidir com uma tag existente depois de o site já estar no ar e reverte o repassador junto (`release.yml:44-50, 106-162`) | Alto | Planejado logo depois dos críticos: entrada de reversão no release, versão pela maior tag do repositório, tag criada antes de publicar e roteiro na skill `publicar`, ensaiado na homologação |
| P32 | **Casca HTML antiga presa no service worker:** o SW novo precacheia o `index.html` com `cache: 'reload'`, que fura o cache do navegador mas não o CDN do Pages (até 10 min). Quem atualiza nessa janela guarda o HTML antigo, que carrega os chunks antigos, até a release seguinte (`service-worker/index.ts:34, 63-66`) | Alto, a confirmar | Planejado com P31: confirmar no Pages e precachear o HTML com `?v=<versão>` ou recusar a instalação se ele não for do mesmo build |
| P33 | **Volta atrás depois de uma migração:** o Dexie 4.4.6 abre um banco mais novo sem travar, mas o que o app antigo gravar nesse intervalo não passa de novo pela `upgrade()` | Médio | Aceito como regra: migrações só aditivas, transformação também tolerada na leitura e teste de "N, N−1, N" a cada versão nova do banco |
| P34 | **A preservação da versão anterior falha calada** (`|| true`) e tem o endereço do `github.io` fixo (`release.yml:93-101`) | Médio | Planejado na etapa 2 (domínio): aviso no job quando o site respondeu e nada foi preservado |
| P35 | **Release sem conferência depois de publicar**, com o repassador em paralelo: se ele falhar, o app novo fica no ar sem tag e a próxima release repete o número (`release.yml:106-148`) | Médio | Planejado na etapa 4: a mesma sonda confere o site e o repassador depois do release |
| P36 | **A troca de domínio é sem volta para os dados locais:** origem nova, IndexedDB novo; só a frase leva a conta. `release.yml:95`, `ORIGENS` do repassador e o convite de teste têm o endereço fixo | Alto | Planejado na etapa 2, com a lista desses lugares e o que a origem antiga mostra, sem nunca apagar dados nela |

## O que já está coberto

Mitigações que o levantamento conferiu no código:

- **Entrega:** fila de saída no IndexedDB com espera de 5 s a 15 min e nova tentativa ao voltar a rede; publicação
  em todos os relays do destinatário; repetidas descartadas pelo id do embrulho (9 dias) e do rumor; numeração por
  conversa (`seq`) com pedido de reenvio e "possivelmente perdida" depois de 7 dias.
- **Rede:** reconexão de 1 s a 60 s, refeita na hora ao voltar ao app e à internet; autenticação NIP-42; aviso de
  sem conexão; lista de relays validada, com a embutida de reserva; 10050 só aceito assinado pelo dono.
- **Mídia:** cifrada, com os hashes `x` e `ox` conferidos, 2 cópias, reservas e endereços de reserva na mensagem,
  tipos perigosos bloqueados nos dois lados (T22) e 20 MB de teto.
- **Cofre:** chave no Web Worker; `sign()` só aceita 3 kinds; PIN com Argon2id e espera crescente (T14).
- **Dados de fora:** nenhum `{@html}` com dado externo; links só `http`/`https`, sem prévia (T18); nomes de perfil
  limpos e limitados; payload do push validado no service worker.
- **CI:** `contents: read` por padrão, segredos só no passo que usa, token fine-grained na homologação, lockfile
  congelado e pnpm sem scripts de instalação.
- **Lançamento:** a produção publica o commit conferido na homologação, com espera de 10 min entre releases; os
  arquivos da versão anterior ficam no ar; faixa "versão nova" sem recarregar sozinho; autocorreção quando o código
  não carrega, sem tocar no IndexedDB; migrações do banco até hoje só aditivas, com testes de v3 e v4 até a atual.
