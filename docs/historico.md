# Histórico de entregas

Como cada item do [roadmap](07-roadmap.md) ficou pronto: o que foi feito, as escolhas do Pedro, as alternativas
descartadas, os bugs achados no caminho e o que ficou de fora. O roadmap guarda só o plano e o estado; o detalhe vem
para cá, com a entrada mais recente no topo. Os limites que continuam valendo também estão no roadmap, em "Limites
conhecidos".

## 2026-11-07: App Android com Capacitor, esqueleto (item 27, etapa 1)

- Decidido ao começar o item ([ADR-0011](adr/0011-app-android-nativo.md)): push pelo FCM, com o UnifiedPush depois;
  APK assinado no GitHub Releases, com a Play depois do beta; interface embutida no APK. Identificador
  `io.github.capaca.lerolero`, que não depende do domínio ainda não registrado (rejeitados `br.com.<domínio>`, que
  esperaria o registro, e `app.lerolero`, domínio que não é nosso).
- `packages/android` com Capacitor 8.6; o app ganhou o `build:nativo`, sem service worker (os arquivos já estão no
  aparelho). Ícone adaptativo e abertura gerados do `icon.svg`, como os do PWA.
- Backup do sistema desligado: o cofre, protegido só pelo PIN, não vai para a nuvem do Google (T15).
- Sem SDK do Android no Mac: o APK de teste ("Lero homolog.", instala ao lado do de verdade, com os servidores da
  homologação) sai pelo `android.yml` como artefato. O Pedro instalou no Motorola e conferiu (#122).
- Ficou de fora: arquivo de recuperação e "compartilhar" no WebView (precisam de plugin), notificações (etapa 3).

## 2026-11-06: Ajustes e proteção da conta (item 26, etapa 3c; item 26 concluído)

- Propostas comparadas com capturas do app; o Pedro aprovou tudo e revisou no celular.
- Ajustes: os sete cartões viraram uma lista agrupada (Conversas, Segurança, Teste), com ícone, nome e o valor ou a
  seta; você no topo numa linha só; o aviso amarelo com "Proteger agora" quando a conta não está protegida; as chaves
  de liga e desliga são as mesmas caixas de seleção de antes, desenhadas como chave (o leitor de tela não muda); o
  tamanho da letra num seletor de três partes.
- Proteção da conta e "Guarde sua frase": o PIN segue sozinho ao completar, sem botão, como no cadastro; as camadas
  (gerenciador de senhas, arquivo, Drive, cartão, anotar) viraram opções com ícone e uma linha de explicação, a mais
  fácil em destaque (classe `.option`). "Ver ou anotar as 12 palavras" entrou como opção, no lugar do link solto.
- Achado no caminho: o botão "Proteger agora" tinha 44 px, e o e2e `textos` exige 48 (RNF-63).
- Com isso o item 26 fica concluído: cores, fonte e ícone (v0.15.0), barra em pedra, cadastro e PIN, e Ajustes.

## 2026-11-06: e2e depois do merge, com travas para a main vermelha (ADR-0006)

- O Pedro trouxe do Sonzeira, projeto irmão (PR #94 de lá), a ideia de os testes pesados deixarem de segurar o PR.
  Medido aqui: em 64 rodadas o e2e levou 5,7 min na mediana, repetido a cada commit novo do PR, e falhou 5 vezes,
  parte por teste instável; a CI normal leva 1,1 min e os testes de integração, 36 s, sem nenhuma falha em 60 rodadas.
- Decidido com o Pedro: o e2e vai para depois do merge, num `e2e.yml` próprio que roda em cada push na `main` que mude
  o app; os testes de integração continuam antes do merge e exigidos; antes do PR, roda localmente só o e2e da área
  mexida e o `textos` (o `verificar.sh` passou a aceitar specs). O status `testes e2e` sai das checagens obrigatórias
  da regra "main protegida", mudado logo depois do merge deste PR.
- Travas, a pedido do Pedro ("é importante ter travas para a IA e para humanos"): a issue `e2e-main` que o workflow
  abre e fecha sozinho; a linha "E2E main" no `situacao.sh`; o aviso no `pr.sh`; e a recusa da release no
  `release.sh` e no `release.yml`, com a consulta única em `scripts/e2e-main.sh`. A diferença do Sonzeira: aqui a
  release publica o commit da homologação, então a trava olha o e2e do último commit até ele que mexeu no que a
  suíte testa, e recusa também uma rodada cancelada por um merge seguinte.
- Testado: `actionlint` nos três workflows; a trava recusando sem o workflow no GitHub, com o `gh` sem credencial e
  sem conseguir ler a homologação (o `disparar` sai antes de disparar); e liberando com uma rodada verde (com uma
  cópia apontada para o `ci.yml`). A issue só abre e fecha na `main`: o primeiro merge que mude o app mostra.

## 2026-11-06: cadastro e PIN novos (item 26, etapa 3b)

- Propostas comparadas com capturas do app; o Pedro aprovou as três telas e pediu a foto já no cadastro.
- Boas-vindas: o ícone grande, o nome e o lema no centro; o parágrafo virou três promessas com ícone (sem telefone
  nem e-mail; a conta fica no aparelho, com PIN; volta com 12 palavras) e os botões desceram para perto do polegar.
  "Já tenho uma conta (tenho a frase)" ficou só "Já tenho uma conta".
- Nome: "Passo 1 de 2" com barra e seta de voltar; a bolinha mostra a inicial ou a foto escolhida (opcional), que sobe
  em segundo plano depois que a conta é criada, sem prender a entrada. Se falhar, a pessoa põe depois em Ajustes.
- PIN: um por vez, no mesmo campo (o foco não sai dele); sem o botão "Criar conta". Se a confirmação não bate, treme e
  volta ao começo, porque não dá para saber qual dos dois saiu errado.
- Achado no caminho: no e2e, recarregar a página logo depois do cadastro interrompia o envio da foto; o teste abre os
  Ajustes pela interface.

## 2026-11-06: barra em pedra em todas as telas (item 26, etapa 3a)

- O Pedro escolheu a barra em pedra em todas as telas, não só na conversa. Um componente `TopBar` (voltar, título e
  ações) substituiu o link "← Início" e o título soltos de cada tela; as cores claras da barra ficaram numa classe
  comum (`.on-bar`), usada também pelo topo da conversa.
- O menu ⋮ da tela inicial só tinha Favoritas e Ajustes: os dois viraram ícones na barra, um toque a menos (pedido
  antigo do Pedro).
- A seta de voltar não mostra mais o texto; o leitor de tela ouve "Voltar para …". Perfil do contato e detalhes do
  grupo têm só a seta, com o nome grande embaixo da foto.
- Ficaram de fora o cadastro, o PIN e a frase (próximo PR) e o guia de teste, que não é tela do app.

## 2026-11-06: identidade visual nova (item 26, etapas 1 e 2)

- O nome Lero-lero fica (Q4) e o tom é brincalhão e brasileiro. O que incomodava: ícone de balão genérico, verde
  parecido demais com o do WhatsApp e a fonte do sistema, com cara de protótipo.
- Três direções foram comparadas numa página com ícone, cores, fonte e uma conversa nos dois temas: **Fuxico**
  (tangerina e azul de caneta, Bricolage Grotesque), **Maracujá** (roxo e amarelo, Baloo 2) e **Calçadão** (anil e
  pedra portuguesa, Outfit). O Pedro escolheu as cores e a fonte do Calçadão com o ícone do Maracujá.
- Numa segunda rodada, ícones sem balão (monograma "ll", telefone de lata, orelhão, aspas, dois falando) foram
  testados nas cores novas; rejeitados, porque o balão com "ll" continuou o melhor.
- No app: anil `#2847c9` (no escuro `#8fa6ff`), fundos e textos com um leve tom azulado; o cinza secundário e o azul
  do tique de "lida" foram escurecidos (e clareados no escuro) para passar de 4,5:1 no balão azulado, o que o axe do
  e2e `textos` pegou na citação dentro do balão enviado.
- A Outfit vem do `@fontsource-variable/outfit` (OFL), embutida no build: um CDN de fontes saberia quem abre o app e
  não funcionaria sem rede. São 32 KB para o alfabeto latino, mais 15 KB baixados só se aparecer letra de outros
  alfabetos latinos.
- O ícone tem a fonte em `static/icon.svg` (também usado como favicon) e os PNGs saem dele por `scripts/icones.js`,
  que desenha no Chrome pelo Playwright do e2e. O desenho fica dentro do círculo do recorte do Android.
- Com só a cor trocada, o Pedro quase não viu diferença; capturas do app ao lado da referência mostraram o que
  faltava. Entraram o balão enviado em anil sólido (o mesmo nos dois temas, com as cores de dentro trocadas para
  claras) e a barra do topo da conversa em pedra, que também virou a cor da barra do celular (`theme-color`).
- O tique de "lida" no balão anil é amarelo: o azul dos outros apps sumiria no fundo azul.
- Ícones: gravar virou a onda de voz e enviar, a seta cheia. Rejeitados o microfone cheio, a seta para cima e o avião
  de papel (o do Telegram). O emoji de microfone da página de referência foi descartado logo de cara.
- A homologação continua com a barra laranja, que contrasta com a pedra da produção.

## 2026-11-05: faixa de avisos para incidentes (P9)

- O Pedro publica um aviso pelo workflow `avisos.yml` (no Actions, também pelo celular): texto de até 280
  caracteres, nível (informação ou problema, em vermelho e na frente) e quantas horas ele vale. O workflow grava o
  `avisos.json` (ou o `avisos-homologacao.json`, lido pela homologação e pelo app em dev) num branch `avisos` sem
  histórico, e o app o lê de `raw.githubusercontent.com`: não depende dos relays, que podem ser o que quebrou, nem de
  release ou deploy do Pages. Um aviso por vez; publicar de novo substitui, e "apagar" tira.
- A faixa fica presa no topo de todas as telas, inclusive antes de entrar na conta e na tela de erro do P8, e a
  conversa encolhe a altura dela (como já fazia com a de sem conexão). "Fechar" esconde aquele aviso só no aparelho;
  um aviso novo tem outro id e aparece de novo.
- O app busca ao abrir, ao voltar para a tela e a cada 5 minutos, com o cache do GitHub de até 5 minutos. A última
  lista fica no `localStorage`: sem internet, com o GitHub fora ou com o banco quebrado, o aviso continua.
- O texto é só texto (nunca HTML nem link clicável), validado no core (`announcements.ts`), para um aviso forjado
  não levar ninguém a lugar nenhum (T27).
- Rejeitados ao começar: refazer o deploy do Pages da produção com o arquivo novo, servir pelo repassador na
  Cloudflare, só o texto sem nível nem validade, e um campo de versões afetadas.
- O e2e `avisos` simula o arquivo do GitHub; a suíte inteira responde "não há avisos", para um aviso de verdade não
  aparecer nas telas dela. A faixa entrou no e2e `textos`, nos dois níveis.

## 2026-11-05: tela de erro quando o banco não abre (P8)

- `session.init()` passou a tratar a falha ao abrir o banco (migração que lança, cota cheia, banco corrompido): em
  vez da tela branca para sempre, aparece "O Lero-lero não abriu", com o texto do erro, a versão e "Tentar de novo"
  (recarrega a página). A tela diz que nada foi apagado e não oferece apagar dados.
- Como o "Enviar comentário" precisa do app aberto, a tela pede uma foto dela para quem convidou para o teste. A
  faixa de avisos do P9 entra nesta tela junto com o P9.
- O e2e `erro-ao-abrir` faz o banco do app falhar ao abrir (o do cofre, no worker, segue normal) e confere que,
  consertado, "Tentar de novo" entra na conta; a tela entrou no e2e `textos`.

## 2026-11-05: só o app na origem da produção (P7)

- A release deixou de montar e publicar o protótipo de medição em `/medicao/`. Ele tinha outro lockfile, `npm ci` com
  scripts de instalação e outras versões de Vite e Svelte; uma dependência comprometida ali rodaria na mesma origem
  da conta de verdade.
- O protótipo continua necessário para o item 20 (medição no aparelho de 2 GB) e passou para a homologação, junto
  de `/senha/` e `/push/`: https://lerolero-app.github.io/lerolero/medicao/. Lá só há contas de teste.
- O `/medicao/` da produção some na próxima release (o Pages troca o site inteiro).

## 2026-11-05: a sessão aberta é só do cofre (P6)

- O cofre grava, lê, renova e apaga a sessão aberta (recarregar sem o PIN por 5 minutos) num banco próprio, o
  `lerolero-sessao`, separado do banco da interface para o worker não disputar as versões do Dexie. A interface só
  pede para abrir, retomar, renovar e fechar, e recebe a chave pública; nunca mais a chave AES nem a cifrada. A
  sessão vencida ou estragada é apagada ao retomar.
- A sessão antiga, que a interface guardava em `sessaoAberta`, é apagada ao abrir: depois da atualização, o PIN é
  pedido uma vez.
- Na análise, a correção prevista não fechava o risco: um script na origem abre o mesmo banco e usa a chave AES, e
  poderia capturar o PIN digitado. O Pedro escolheu fazer a mudança e tirar o P6 dos críticos; a defesa contra
  script na origem fica com o P7 e o P23. Rejeitados: acabar com a entrada sem PIN e só reclassificar.
- Testes no `identity.test.ts` (a sessão no IndexedDB do cofre, renovar, vencer, fechar); os e2e que vencem a sessão
  apagam no banco novo.

## 2026-11-05: backup quase vazio não substitui mais o bom (P5)

- "Não há backup" só vale quando os três relays gerais responderam. Antes, bastava um relay de DM (que guarda só 7
  dias) responder "nada" enquanto o que tinha o backup passava dos 8 s, e o aparelho publicava o seu, sem contatos
  nem grupos, por cima do bom. Sem a resposta de todos, o aparelho não publica e procura de novo na próxima abertura.
- Antes do primeiro backup que o aparelho publica, procura mais uma vez. Se o achado tem contatos ou grupos que o
  aparelho não tem, não publica e pergunta: "Trazer para este aparelho" (junta e publica) ou "Descartar o backup
  antigo" (publica o deste aparelho por cima). Fechar o aviso deixa a pergunta para a próxima abertura, sem publicar.
- O Pedro escolheu as duas proteções e o aviso, com "Trazer" como principal. Rejeitados: só exigir os relays gerais;
  juntar sozinho, sem perguntar; e o aviso por ter menos contatos que o último backup visto, que quase nunca
  dispararia (o app só vê um backup quando já o juntou).
- Testes: no core, a busca que exige os relays gerais e a contagem do que falta no aparelho; no e2e, o relay que
  "demora" com o backup na restauração (`esconderBackup`), com as duas escolhas, e o aviso no `textos`.
- Achado na CI deste PR: o `sync.test.ts` deixava, em metade das rodadas, uma rejeição sem tratamento
  (`DatabaseClosedError`). `stop()` esperava a fila de recebimento, mas não a rodada de envio em andamento, que seguia
  gravando com o banco já fechado. Agora `stop()` espera as duas (o "Bloquear" também), e `flush()` não lança: o que
  não saiu fica na fila para a próxima rodada.
- Também achado: o teste do P1 lia o cursor logo que as mensagens chegavam, mas desde o P2 ele só é gravado quando o
  histórico termina; agora espera o cursor.

## 2026-11-05: mensagem que ficou horas na fila de saída chega (P4)

- A fila guarda o rumor de cada embrulho. Item que passou de 1 hora na fila sai num embrulho novo, com horário
  novo, para os relays que ainda não o aceitaram; o id do item na fila não muda. O horário do embrulho é recuado em
  até 2 dias na hora de escrever e quem recebe busca só até 2 dias antes do cursor: com 1 dia na fila, metade se
  perdia; com 1 hora, a chance cai para 2%.
- Vale para tudo o que vai embrulhado, inclusive o que não tem `seq` e nem o reenvio recupera (confirmações,
  reações, avisos de grupo, apagar, editar) e a cópia dos meus aparelhos. O embrulho com prova de trabalho é refeito
  com prova.
- O cofre ganhou `refreshWrap`: só rumor meu, com o id certo, que passe nas mesmas checagens de `wrapDirectMessage` e
  `wrapGroupMessage`, para quem estava na mensagem ou para mim. Não dá à interface nada que ela já não pudesse pedir.
- Se o cofre não refizer (trancado), sai o embrulho antigo. Itens que já estavam na fila antes da atualização não
  têm o rumor e saem como estão.
- Testes de regressão no `sync.test.ts` (falha sem a correção) e no `identity.test.ts`.

## 2026-11-05: falha passageira não descarta mais a mensagem recebida (P3)

- Só o embrulho que não abre (`InvalidWrapError`, cujo nome atravessa o worker) é marcado como visto depois de
  falhar. Cota cheia, worker reiniciado, cofre trancado ou qualquer outro erro deixam o embrulho para a próxima
  sincronização, e o cursor daquele relay não passa dele até uma leitura nova do histórico (reconexão ou reabrir).
- O "Bloquear" espera o embrulho em processamento terminar (até 5 s, para um worker travado não travar o botão)
  antes de trancar o cofre; o resto da fila fica para depois, sem ser marcado.
- Considerado e rejeitado: listar os erros passageiros (cota, banco fechado, cofre trancado). Um erro não previsto
  voltaria a perder mensagem; o custo do caminho escolhido é baixar de novo um trecho do histórico enquanto um
  embrulho com bug continuar no relay (limite conhecido no roadmap).
- Testes de regressão no `sync.test.ts`, que falham sem a correção.

## 2026-11-05: o cursor não pula mais o histórico (P2)

- O cursor de cada relay só é gravado quando o histórico inteiro foi processado; até lá, o maior horário fica só
  anotado. Fechar o app (ou o iPhone suspender) no meio da sincronização não pula mais o resto: a próxima refaz a
  partir do cursor antigo, e o que já foi processado não se repete.
- Depois do EOSE, o app pede de novo com `until` no embrulho mais antigo recebido, até não vir nada mais antigo.
  Como o limite de resultados de cada relay não é conhecido, sempre há essa página extra (quase sempre vazia), em vez
  de adivinhar quando o relay cortou. Na primeira sincronização (restauração, aparelho novo) nada antigo fica de fora.
- Relay que não responde à página extra deixa o cursor onde estava, e a próxima assinatura tenta de novo.
- Testes de regressão no `sync.test.ts`; o relay falso ganhou um limite de resultados para simular o corte.

## 2026-11-05: embrulho datado do futuro não trava mais o recebimento (P1, T26)

- O cursor de cada relay nunca passa do relógio do aparelho, e o embrulho mais de 1 hora à frente é descartado sem
  ser aberto nem mexer no cursor. A folga de 1 hora deixa chegar a mensagem de quem tem o relógio um pouco adiantado
  (o NIP-59 só recua o horário, e os relays costumam recusar o que vem muito à frente).
- Aparelho que já estava travado volta a receber: o cursor guardado no futuro volta ao relógio ao abrir.
- Testes de regressão no `sync.test.ts`, que falham sem a correção.

## 2026-11-05: levantamento dos riscos de prontidão (item 23, etapa 3)

- O código foi lido tema a tema (confiabilidade, escalabilidade, resiliência, segurança, monitoramento e lançamento),
  e os 36 riscos achados estão em [08](08-prontidao.md), cada um com a decisão: corrigir antes do beta, planejado ou
  aceito no beta.
- **Críticos:** o Pedro escolheu corrigir antes do beta os oito de perda e de chave (P1 a P8): embrulho datado do
  futuro que trava o recebimento (T26, novo), cursor que avança antes de o histórico terminar, embrulho descartado
  por erro passageiro, mensagem que ficou dias na fila e não chega, backup quase vazio por cima do bom, sessão
  aberta que expõe a chave à interface (muda o T16), protótipos na origem da produção e tela branca quando o banco
  não abre. Rejeitados: incluir também os altos, que atrasariam o beta, e corrigir só os de perda de mensagem.
- **Incidentes:** faixa de avisos no app, lida de um `avisos.json` republicado sem release nova (P9). Rejeitado por
  ora: um grupo de WhatsApp ou Telegram com quem testa.
- O limite conhecido da falha de gravação é mais largo do que estava escrito: vale para qualquer erro, inclusive o
  cofre trancado no meio da sincronização (P3).

## 2026-11-05: decisões da revisão de prontidão (item 23, etapa 1)

- **Domínio próprio (Q-N1):** o Pedro decidiu comprar um `.com.br` (~R$ 40/ano, registro.br) antes do beta, apontado
  para o GitHub Pages. É a única exceção ao custo zero (RNF-84, princípio 3 da Visão). O motivo é a origem: conta,
  conversas e mídia ficam no IndexedDB do endereço, e os convites levam o endereço; quem entrasse no beta pelo
  `github.io` perderia tudo na troca e teria de restaurar pelo código. Também destrava a passkey (item 15).
  Rejeitados: beta no `github.io` e subdomínio gratuito (eu.org, is-a.dev), que depende de terceiros e parece menos
  confiável a leigos. Quem usa hoje o `capaca.github.io` restaura pelo código no endereço novo.
- **Dados técnicos de uso (Q-N6):** aprovado o resumo opt-in automático, já no beta, como proposto em 2026-10-22:
  desligado por padrão, só contagens e tempos, cifrado pela própria rede com chave descartável, com tela "ver o que é
  enviado". O RNF-50 e o princípio 7 da Visão foram reescritos. Rejeitados: só o diagnóstico enviado à mão e nenhum
  dado.
- **Servidor próprio (Q-N7):** não no beta. 20 pessoas cabem nos relays públicos, e as sondas sintéticas mostram se
  faltar capacidade; reavaliar antes do lançamento público.
- O resto do item segue em etapas: domínio, levantamento dos riscos por tema, sondas e painel, resumo opt-in.

## 2026-11-05: convite para ativar as notificações (depois da v0.12.0)

- Decisão do Pedro: a ativação só em Ajustes deixaria quase todo mundo sem aviso, então a tela inicial convida
  ("Quer ser avisado quando chegar mensagem?", com **Ativar** e **Agora não**). Muda o RF-82, que dizia só Ajustes.
- Aparece depois da primeira conversa, nunca junto do lembrete da frase (que vem antes), e não aparece com as
  notificações já ativas, com a permissão bloqueada, sem suporte ou no iPhone sem o app instalado. "Agora não" vale
  para sempre neste aparelho (`localStorage`, como o tamanho da letra); Ajustes continua com a opção.
- Também proposta, e não escolhida: uma mensagem pronta para o grupo de testadores.
- Roteiro de aceite: passo 24 (extra) com o aviso chegando e o toque abrindo a conversa.
- No e2e, o Chrome da suíte responde "bloqueada" para a permissão não concedida (o convite some, como devia); o teste
  dá a permissão. A entrega do aviso pelo DevTools logo depois de sair da página às vezes caía com a página ainda
  visível: o teste entrega de novo até a notificação aparecer.

## 2026-11-04: notificações no app (item 25, etapa 3)

- Ajustes → Notificações liga e desliga os avisos neste aparelho: pede a permissão, gera o par VAPID, se inscreve e
  manda o cartão novo a quem já conversou comigo. No iPhone fora da tela de início, a tela explica que é preciso
  instalar; navegador sem Web Push vê só um aviso.
- O service worker (`service-worker/push.ts`) mostra "Mensagem de <nome>" com o nome que o aparelho conhece (lê o
  IndexedDB do app sem mudar a versão do banco) e, em grupo, o nome do grupo. Com o app visível não mostra nada.
- Tocar abre a conversa: com o app aberto, o service worker pede a navegação à página (recarregar trancaria o cofre);
  bloqueado, o PIN vem antes e depois abre a conversa pedida, não o início.
- A cada abertura o app confere se a inscrição continua a mesma: a permissão retirada nas configurações desativa, e
  a inscrição trocada pelo navegador (ou perdida numa troca de chaves que falhou) é refeita.
- O guia de teste ganhou o passo de ativar as notificações, e a limitação "Sem notificações" virou "O aviso pode
  atrasar" (com o celular parado, só ao desbloquear).
- O e2e `notificacoes` simula a inscrição com as chaves do `fakePushDevice`, intercepta o repassador, decifra o aviso
  (só `de` e `nome`, sem o texto) e o entrega ao service worker pelo DevTools com a página fechada; confere a
  notificação, o PIN antes da conversa e que desativar tira o endereço do cartão.
- Ficou de fora: o texto da notificação sai sempre em português (limite no roadmap).

## 2026-11-04: Web Push no core (item 25, etapa 2)

- `packages/core/src/push`: a cifra do aviso (RFC 8291) e o JWT VAPID (RFC 8292) com o WebCrypto, portados de
  `prototipos/push/comum.js`; o teste confere byte a byte com o exemplo do apêndice A do RFC 8291 e decifra como o
  navegador (`testing/fake-push.ts`).
- O cartão de perfil leva até 3 tags `push`, uma por aparelho meu que ativou; os aparelhos combinam a lista por um
  rumor kind `4445` só para mim mesmo, e quem descobre um aparelho novo se apresenta de volta. Geração de
  sincronização 9, para quem atualizar reler os cartões e avisos que a versão anterior ignorou.
- O aviso sai depois que a mensagem chega ao primeiro relay do destinatário (`onSent` da fila), então vale também para
  a fila offline e para cada membro do grupo. Rajada para a mesma pessoa: um aviso na hora e um ao fim de 15 s.
  404 ou 410 do serviço tiram aquele aparelho do cartão guardado.
- Bloquear troca a inscrição e o par VAPID do aparelho e manda o cartão novo a quem ficou.
- Decisões do Pedro: o grupo aceito conta como aceite dos membros para avisos (rejeitado só contatos aceitos) e até 3
  aparelhos por conta (rejeitado só o último que ativou).
- O endereço do repassador vem do build (`__APP_REPASSADOR__`): o da homologação no `vite dev` e na homologação, o da
  produção na release, ou `APP_REPASSADOR` (para o e2e da etapa 3).
- Ainda sem efeito para ninguém: ativar as notificações (Ajustes, permissão, service worker) é a etapa 3; até lá
  nenhum cartão leva `push` e nenhum aviso sai.
- Ficou de fora: a troca de chaves ao bloquear só vale no aparelho onde se bloqueou (limite no roadmap); um contato
  consegue forjar um aviso com o nome de outro (T25, aceito).

## 2026-11-04: repassador de Web Push (item 25, etapa 1)

- `packages/repassador`, um Cloudflare Worker sem estado que recebe do app o aviso já cifrado e o JWT VAPID e só faz
  o POST no serviço de push, devolvendo o status dele (410 = inscrição cancelada). Confere cada campo: destino em
  https num dos serviços conhecidos (FCM, Mozilla, Apple, Windows), sem porta, usuário nem redirecionamento; TTL até
  28 dias; `Urgency`; o formato do `Authorization`; aviso de até 4096 bytes.
- Decisões do Pedro: 120 pedidos por minuto por IP (o binding de rate limit gratuito do Workers; rejeitados 60 e
  300) e só as origens do app (rejeitado aceitar qualquer origem). A homologação aceita também localhost e a rede
  local, para o dev e o `celular.sh`. Conta da Cloudflare: a que o Pedro já usa em outro projeto.
- Deploy pela CI: `repassador.yml` publica o worker da homologação a cada merge que muda a pasta; a release publica o
  da produção com o mesmo commit validado. Logs do Workers desligados, para o IP e o endereço de push não ficarem
  guardados.
- Achado no caminho: o runtime do Workers recusa qualquer export que não seja handler no arquivo de entrada (o
  `wrangler dev` falhou com `BODY_MAX_BYTES`), então a lógica ficou em `repassador.ts` e a entrada em `index.ts`. O
  `pnpm check` do pacote roda o `wrangler deploy --dry-run` dos dois ambientes para pegar erro de configuração na CI.
- Conferido localmente no `workerd`: o pedido chega ao FCM de verdade e o limite corta no 121º pedido do minuto.
- No ar na homologação em https://lerolero-repassador-homologacao.pedro-capaca.workers.dev (subdomínio `workers.dev`
  da conta que o Pedro já usa em outro projeto); a produção fica em `lerolero-repassador.pedro-capaca.workers.dev`
  depois da próxima release. Token "lerolero-repassador-ci" com a permissão legacy Workers Scripts Read e Write na
  conta inteira (a nova, por Worker, só vale para Workers que já existem), válido até 2027-11-04, com aviso no
  `situacao.sh` 30 dias antes e na agenda do Pedro.
- O primeiro deploy falhou dizendo que a conta não tinha subdomínio `workers.dev`, com token e conta conferidos pela
  API. Não eram espaços nos secrets (o workflow agora limpa e avisa, e o aviso não apareceu); a nova tentativa passou
  sem mudar nada. Causa não confirmada, provavelmente o token recém-criado.

## 2026-11-03: acessibilidade manual, com alvos de toque de 48 px

- Item 22, parte manual. O e2e `textos` passou a medir, em cada tela, todo elemento tocável menor que 48 px
  (RNF-63; o axe-core só exige 24). Na primeira rodada achou uns 30: a barra "Voltar" do topo com 24 px de altura, a
  seta e o nome no cabeçalho da conversa, os botões do campo de mensagem (40 px), o tocador de áudio, as bolinhas do
  PIN, a grade de emojis, links sozinhos na linha, "Detalhes técnicos" e os rótulos das caixas de seleção.
- Tudo foi para 3rem, que nunca fica abaixo de 48 px porque o tamanho da letra só aumenta a raiz. No cabeçalho e no
  "Voltar", margem negativa para não engordar a tela. O chip de reação e a velocidade do áudio continuam pequenos na
  tela, com uma área de toque invisível de 48 px em volta (classe `touch`), que o teste também conta.
- Exceção decidida: os nove atalhos de grupo do seletor de emojis ficam com uns 41 px, porque não cabem numa linha
  de celular, e rolar a lista chega ao mesmo grupo (o "controle equivalente" da WCAG 2.5.8). Rejeitados: rolagem lateral
  dos atalhos, que esconderia grupos, e duas linhas, que tirariam espaço da grade.
- Os botões do campo de mensagem cresceram de 40 para 48 px, então sobram uns 24 px a menos para o texto; o Pedro
  achou aceitável no celular.
- O Pedro conferiu no Motorola o TalkBack (PIN, lista, conversa, texto e áudio, menu da mensagem, reações, Ajustes) e
  a fonte do sistema no máximo com o zoom do Chrome a 200%, sem achados.
- O teste da conversa no `textos` ganhou 2 minutos: com o axe nos dois temas e a medição em umas vinte telas, passava
  de 60 s no Mac ocupado.

## 2026-11-02: mais espaço para o texto no campo de mensagem

- Com o botão de emojis, o campo tinha quatro botões ao redor e sobravam uns 90 px para o texto num celular de
  360 px. Emoji, clipe e foto passaram para dentro da moldura do campo, mais estreitos (emoji à esquerda, clipe e foto
  à direita, como no WhatsApp), e a foto some enquanto há texto: uns 150 px com o campo vazio e 190 px ao digitar.
  Aprovado pelo Pedro no celular. O e2e `textos` acha o botão de emojis pelo `aria-expanded`, não mais pela posição.

## 2026-11-02: linguagem simples (item 21, RNF-64)

- Revisão dos 683 textos de `pt-BR.json`. Um nome só para as 12 palavras: **frase de recuperação**, também no arquivo
  (agora `lerolero-frase-de-recuperacao.txt`), no cartão e no gerenciador de senhas. Escolha do Pedro, que revê a regra
  1 do ADR-0009 (rejeitado: "código" em todo o app). Arquivos antigos continuam abrindo: a leitura usa o link ou a
  lista numerada, não o título.
- Chave pública e servidores saem do topo dos Ajustes para **Detalhes técnicos**, fechado no fim da tela (escolha do
  Pedro; rejeitados: só trocar as palavras no lugar, e tirar a chave da interface). Lá a chave virou "identificador da
  conta" e os relays, "servidores de mensagens".
- Outras trocas: "cifrado" → "protegido por criptografia"; "offline" → "sem internet"; "Bug" → "Problema" no
  comentário; "chave reserva" → "único jeito de recuperar"; o exemplo de link sem `nprofile1`; a voz do app em
  "Não achamos" / "Não sabemos" no lugar de "Não achei" / "Não sei". O guia e o roteiro passaram a citar os arquivos,
  e o roteiro corrigiu o passo que começa o dia sem internet (7) e o fim dos extras (23).
- Trava nova: o e2e `linguagem` lê o `pt-BR.json` e falha com relay, npub, hash, cifrado, offline, bug ou "código"
  (fora de "código QR"), exceto nos Detalhes técnicos e na medição do app em dev.
- *Bug achado no caminho (do item 19):* num aparelho lento, tocar na carinha logo depois de enviar abria o painel de
  emojis e ele fechava sozinho, porque o campo só pegava o foco quando o envio terminava. Agora pega na hora. Teste de
  regressão no e2e `emojis`, com o processador 6× mais lento (falhava 3 de 3 sem a correção). *Ficou de fora:* uma leitura com
  pessoas leigas, que fica para o beta fechado (item 24).

## 2026-11-02: botão de emojis (item 19, RF-29)

- Botão com carinha no campo de mensagem, ao lado do clipe: abre um painel no lugar do teclado, e cada toque põe o
  emoji onde estava o cursor. Tocar no campo ou no botão (que vira um teclado) fecha o painel. E2e `emojis`.
- O "+" do menu da mensagem abre o mesmo seletor no lugar dos itens do menu; os seis principais continuam no topo.
  Saiu do core a lista fixa de 48 (`REACTION_PICKER`).
- Escolhas do Pedro: lista gerada do `emojibase-data` em português, busca por nome e o mesmo seletor nas reações.
  Rejeitados: lista à mão (faltariam emojis e a busca seria pobre), componente pronto (peso, visual e textos dele,
  e passar no axe e na pseudolíngua) e seletor sem busca.
- `packages/app/scripts/emojis.js` gera `src/lib/emojis.json` (só no desenvolvimento; o pacote não vai para o app):
  1.640 emojis em 9 grupos, sem tons de pele e até o Emoji 11.0 (Android 9 mostra todos; no Android 8 do aparelho
  de referência faltam ~150). São 110 KB, 34 KB comprimidos, baixados na primeira vez que o seletor abre.
- Busca sem acento ("coracao" acha "coração"), cada palavra digitada é o começo de uma palavra do nome ou das
  palavras-chave do emojibase ("kkk" acha 😂). "Mais usados" (até 16) abre o seletor e ordena a busca; a contagem
  fica no aparelho (`localStorage`), como o tamanho da letra.
- Desempenho: os grupos fora da tela não são desenhados (`content-visibility`), para o aparelho de 2 GB.

## 2026-11-02: arquivos e "Salvar" (item 18, RF-44 e 45)

- Arquivos vão pelo caminho das fotos (cifra, Blossom, repetição, RF-70, encaminhar), com a tag nova `name`. Foto
  escolhida pelo clipe é comprimida como foto; áudio escolhido vira arquivo comum; vídeo é recusado.
- Escolhas do Pedro: 20 MB por arquivo (sonda sem autenticação: o jumble corta em 20 MiB, os outros cinco não informam;
  10 e 50 MB rejeitados), executáveis bloqueados nos dois lados (T22) e uma opção só de "Salvar", por sistema.
- O primeiro toque no arquivo baixa e o seguinte salva: no iOS, compartilhar exige um toque recente, que se perde na
  espera do download.
- O tempo de envio e de download passou a crescer com o tamanho (30 s + 100 KB/s): os 30 s fixos derrubariam 20 MB.
- Ficou de fora: progresso em porcentagem, e o limite real dos cinco servidores que pedem autenticação.

## 2026-10-30

- **Aviso de versão nova mais rápido** (item 17). Com o app aberto, a busca por versão nova, que só rodava ao voltar para
  ele, passa a rodar também a cada 5 minutos, só com o app na tela, para não gastar franquia em segundo plano. Cada busca
  é uma consulta pequena ao service worker. O cache de até 10 minutos do Pages continua até haver domínio próprio
  (Q-N1). O e2e `atualizacao` cobre os dois caminhos, o da volta ao app e o do relógio adiantado em 5 minutos.
- **Acessibilidade automática** (item 22, parte automática, escolhida pelo Pedro; RNF-60). O e2e `textos`, que já passa
  por todas as telas, roda também o axe-core (regras WCAG 2.0 a 2.2 A e AA) em cada uma, e de novo só o contraste no
  tema escuro; qualquer achado faz o teste falhar, então tela nova entra coberta. Achados e correções: texto cinza
  (`--muted`) abaixo de 4,5:1 no balão verde e na citação (escurecido no claro, clareado no escuro); nome na citação
  em verde puro sobre o fundo dela (puxado para a cor do texto); no tema escuro, botões vermelhos com texto branco a
  2,3:1 (novo `--danger-fg`, escuro); iniciais do avatar e nome de quem escreveu no grupo, que vêm de uma cor tirada
  da chave e falhavam em alguns matizes (mais escuros, passam em todos); o botão da citação e o da velocidade do
  áudio tinham um nome para o leitor diferente do que aparece (WCAG 2.5.3, quem comanda por voz diz o que vê). Fica
  para a revisão manual: TalkBack, fonte a 200% e alvos de 48 dp.
- **Velocidade da suíte e2e** (item 16, primeira etapa, escolhida pelo Pedro; #77 e #78). O teste `perdas` esperava de
  verdade a janela antes de pedir o reenvio (`GAP_WAIT_S`, 30 s) mais a volta que confere (`GAP_CHECK_MS`, 15 s);
  agora adianta o relógio da página com `clock.fastForward` e caiu de ~38 s para ~5 s. Junto com o bug do envio sem
  rede (2026-10-29), a suíte da CI saiu de 4,7 min para ~4 min e não tem mais espera fixa grande. Mais workers não
  ajudaram: num PR só de medição, na mesma `main`, 2 workers levaram 4,1 min, 3 levaram 4,3 e 4 levaram 4,4, com cada
  teste até 3 vezes mais lento (cada um abre 2 ou 3 Chromes); a CI ficou com 2 (escolha do Pedro, depois de ir para 4
  no #78). A variação entre máquinas da CI é grande: a mesma suíte com 2 workers já deu 3,3 e 4,1 min. Rejeitado por
  ora: dividir em dois jobs (`--shard`), que gasta o dobro de minutos.

## 2026-10-29

- **Bug: sem internet, cada mensagem levava ~10 s para aparecer** (RNF-12; e2e `envio-sem-rede`). Achado ao medir a
  suíte e2e (item 16): os envios iam numa fila só, e a mensagem seguinte esperava a anterior buscar os relays do
  contato, que sem rede espera o prazo inteiro. Agora guardar e mostrar seguem numa fila, e a busca dos relays e a
  prova de trabalho noutra, na mesma ordem. O teste passa a exigir cada uma na tela em 3 s e caiu de 37 s para 6 s.
- **Passkey adiada** (item 15, RF-08). Como ela só começa depois da decisão do domínio (Q-N1), o Pedro preferiu
  seguir para o polimento (item 16) e deixar a passkey para depois do beta. O domínio passa a ser decidido na revisão
  de prontidão. Rejeitadas por ora: ficar no `github.io` já para a passkey (ela nasceria presa a `capaca.github.io`) e
  comprar um `.br` agora (quebra o orçamento zero). O `situacao.sh` passa a pular os itens marcados "➡️ Adiada em".
- **Código de recuperação no gerenciador de senhas** (item 14, RF-09 b, D1 do ADR-0009; e2e `protecao` e
  `textos`). Em "Proteção da conta" e em "Guarde seu código", depois do PIN, "Guardar no gerenciador de senhas" vem
  antes do arquivo: no Chrome, pelo `PasswordCredential`, com a conta "<nome> · Lero-lero"; sem ele (Safari,
  Firefox), um formulário de conta e código que é enviado por `fetch` e some. Como no arquivo, a conta só fica
  protegida quando a pessoa toca em "Salvei no gerenciador", porque o app não sabe se ela aceitou o aviso; "Não
  apareceu nada" volta ao botão. Na restauração, "Usar o código salvo no navegador" (só onde há `PasswordCredential`)
  preenche as palavras pelo `credentials.get`, também as salvas em outro aparelho da mesma conta; sem nada salvo,
  avisa. Revisado pelo Pedro no Motorola (o aviso do Chrome apareceu). Fica de fora: o preenchimento automático no
  formulário da restauração para Safari e Firefox, e a medição no iPhone.

- **Medição da frase no gerenciador de senhas** (item 14, primeira etapa; D1 do ADR-0009; #72). Protótipo
  `prototipos/senha` (HTML puro), publicado só na homologação em `/lerolero/senha/` para medir sem release, com três
  jeitos de salvar: A, formulário enviado por `fetch` que some; B, formulário seguido de troca de página; C,
  `PasswordCredential`. No Chrome do Mac, os três ofereceram salvar. No Motorola, no PWA instalado, o B ofereceu
  salvar, o C salvou (a restauração achou a conta dele) e o A ficou sem resposta; a frase voltou inteira, com as 12
  palavras, pelo preenchimento automático e pelo `credentials.get`, que também trouxe uma frase que o aparelho não
  tinha criado, provavelmente a salva no Mac pela conta Google (não confirmado). Escolha do Pedro: a D1 entra no
  Android, com o C e o A de reserva. iPhone pendente, por não haver um aparelho.

- **Arquivo ou cartão de recuperação** (item 13, RF-09 a, D2 do ADR-0009; testes `identity.test.ts` e e2e
  `protecao`), num PR só (escolha do Pedro). Nova tela "Proteção da conta" (Ajustes › Proteção da conta, com o
  estado), que pede o PIN e oferece "Salvar no celular" (baixa o arquivo), "Mandar para o Drive ou outro app" (o menu de
  compartilhar, onde ele aceita arquivos) e "Imprimir o cartão", com as palavras e um QR do link. Bug achado na
  revisão no Motorola: com um botão só, que compartilhava e baixava se o compartilhar falhasse, nada acontecia; o
  download depois de um `await` perde o toque, e o erro do compartilhar não aparecia. Agora o download sai no próprio
  toque e o erro do compartilhar aparece na tela (regressão no e2e `protecao`). Pelo `http` do `celular.sh`, o menu de
  compartilhar do Android não abriu e a promessa não terminou (o toque seguinte deu `InvalidStateError`); o botão
  passa a ficar desligado enquanto um compartilhar está aberto. *A conferir na homologação (HTTPS):* se o "Mandar
  para o Drive" abre o menu; se não abrir, o botão sai no Android antes da release. A tela "Guarde seu código" do primeiro contato passou a usar o arquivo
  como jeito principal; anotar as palavras e conferir duas ficou como alternativa. O lembrete da tela inicial leva a
  "Proteção da conta". O arquivo é um `.txt` em texto aberto, com o nome da pessoa, o aviso de não mandar a ninguém, o
  link `/restaurar#palavra-palavra-…` e a lista numerada. Em "Já tenho uma conta", "Abrir o arquivo de recuperação"
  lê o link ou, se ele não servir (domínio novo, texto editado), a lista; o link preenche as palavras e as tira do
  endereço na hora (T21, risco novo aceito). Escolhas do Pedro (Q-U2): texto aberto em vez de cifrar com o PIN; `.txt`
  em vez de `.html`; a conta fica protegida ao tocar em "Guardei o arquivo" depois de salvar ou imprimir, sem conferir
  palavras (rejeitados: contar só por compartilhar, e exigir o teste das palavras). Nas telas novas a interface fala
  em "código de recuperação"; a tela das 12 palavras manteve "frase". *Ficou de fora:* saber se a impressão saiu de
  fato (o navegador não conta), e trocar "frase" por "código" no resto do app.
- **Detecção de perdas** (item 12, RF-53; testes `losses.test.ts` e e2e `perdas`), num PR só (escolha do Pedro).
  Cada mensagem de texto ou arquivo leva o número `seq` na conversa; quem recebe e nota um buraco espera 30 s e pede
  o reenvio (kind 4444, sem nada na tela), e quem enviou reenvia sozinho o mesmo rumor, com o mesmo id, a partir da
  cópia local. Sem confirmação em 7 dias, a mensagem mostra "Talvez não tenha chegado" com o botão "Reenviar", que
  nos grupos vai só a quem não confirmou. Escolhas do Pedro: reenviar sozinho em vez de esperar o toque, só a quem
  não confirmou em vez de a todos, e nada na tela de quem recebe em vez de um aviso. Para reenviar o mesmo id, as
  minhas mensagens passaram a guardar o rumor (as de antes não têm e nunca ficam perdidas); o `rewrapGroupControl`
  do cofre virou `rewrap`, que também aceita mensagens, só para quem estava nelas. Geração da sincronização 8, para
  quem atualiza reprocessar os pedidos que a versão antiga ignorou. O e2e perde um embrulho de verdade: desvia o
  WebSocket do remetente e responde um OK falso. *Ficou de fora:* reenviar a edição junto.

- **Retenção dos relays conferida** (Q-R1; `prototipos/relays`, `npm run testar -- retencao`, 7,7 dias depois de
  publicar). Toda a lista padrão guardou tudo, menos o Blossom cdn.hzrd149.com, que estava no ar e apagou o arquivo:
  saiu das reservas e entrou o blossom.jumble.social (escolha do Pedro). `relays.json` deixa de ser provisório; com a
  data nova, os apps já instalados pegam a lista sozinhos. Fora da lista, 8 relays perderam eventos (damus, snort,
  relay.nostr.net e outros menores). No Mac do Pedro, o Node só fala com os relays reais com
  `NODE_OPTIONS=--use-system-ca` (interceptação de TLS).

- **Prova de trabalho e "Possível spam"** (item 11, RF-90, T8; testes `pow.test.ts`, `requests.test.ts`,
  `groups.test.ts` e e2e `spam`), em dois PRs. Quem envia põe a prova (NIP-13) no gift wrap do que vai para alguém
  que ainda não lhe escreveu no 1:1, e do aviso que põe alguém num grupo; a mensagem aparece na tela na hora e a prova
  é feita no worker. A mineração é do cofre (`proveWrap`, SHA-256 em WASM do hash-wasm), e não o `minePow` do
  nostr-tools, que trocaria o horário sorteado do embrulho (NIP-59) pela hora atual. Dificuldade de **14 bits**, pela
  medição no Motorola do Pedro (média 196 ms; 16 bits deu média de 870 ms e uma de 4,9 s). Quem recebe confere a
  prova; o pedido de quem não é contato sem ela fica em **"Possível spam"**, no fim dos Pedidos, sem ponto nem
  contagem, com no máximo 50 conversas. Escolhas do Pedro: mandar para Pedidos sem aviso em vez de descartar (quem
  está numa versão antiga ou em outro app Nostr continua conseguindo escrever) e calibrar no celular dele.
  *Corrigido na especificação:* "descartar sem decifrar" não é possível (o remetente só aparece ao abrir) e "só a
  primeira mensagem" não fecha (quem envia não sabe se já foi aceito). *Limite:* 14 bits custam milissegundos num
  servidor; a prova encarece o spam barato, e a defesa principal segue sendo a caixa de Pedidos. *Ficou de fora:*
  medir no aparelho de 2 GB (a medição continua em Ajustes no app em dev) e limite de mensagens por conversa suspeita.

- **Backup cifrado** (item 10, RF-06; testes `backup.test.ts` e e2e `backup`). Um evento kind `30078` (NIP-78) com a
  tag `d` `lerolero/backup`, cifrado com NIP-44 para a própria chave pelo cofre (método próprio: o `sign` continua sem
  assinar esse kind). Leva o nome e a foto (a referência no Blossom), os contatos aceitos e bloqueados com o nome dado a
  cada um, os grupos de que participo e dois ajustes: confirmação de leitura e relays onde recebo. O tamanho da letra
  fica por aparelho. Escolhas do Pedro: as favoritas **não** entram (rejeitados: o texto das 100 mais recentes e uma
  opção em Ajustes; ver RF-06), o perfil entra e a restauração não pede o nome quando acha o backup, e tudo num PR só.
  A restauração passou a ter duas etapas: frase e PIN; o nome só aparece se não houver backup (com um aviso diferente
  se foi falta de rede). O grupo restaurado vira o ponto de partida do replay (`RESTORED_ACTION`), e os avisos que
  chegam depois seguem dele. O backup sai 5 s depois da última mudança, só se o conteúdo mudou, e de novo a cada 3 dias
  para não sumir de relay que apaga o antigo. *Cuidado de projeto:* um aparelho que ainda não sabe se há backup nos
  relays (restaurou sem rede) não publica nada até conferir, para não apagar o bom com um quase vazio; por isso a
  consulta ao pool passou a contar quantos relays responderam (`queryAnswered`). *Ficou de fora:* favoritas e
  mensagens antigas; a foto só volta se o arquivo ainda estiver no Blossom. Quem já usava o app publica o primeiro
  backup ao abrir esta versão. *Achado na validação do Pedro:* depois de restaurar, as mensagens dos últimos 7 dias
  voltavam como não lidas (o "lida" não é sincronizado entre aparelhos; já acontecia antes do backup). Decidido pelo
  Pedro: o que chegou antes do momento da restauração entra como lido e sem confirmação de novo (rejeitados: lido até
  a minha última resposta, mais pesado, e deixar como estava). Teste de regressão em `messaging.test.ts` e no e2e.
- **Editar mensagem e mencionar com `@`** (item 9, RF-24 e 35; testes `edits.test.ts` e e2e `editar-mencionar`).
  Escolhas do Pedro: editar até 15 minutos (rejeitados: 1 hora e sem prazo), com a marca "editada" e sem guardar o
  texto antigo (rejeitado: mostrar o histórico), e tudo num PR só. A edição é o kind `4443`, com o texto novo inteiro;
  só vale de quem escreveu e só para texto. Como a ordem dos embrulhos varia, uma edição que chega antes da mensagem
  fica esperando por ela. "Editar" fica no menu das minhas mensagens; o campo mostra "Editando mensagem" e o botão de
  salvar. A menção vai como `nostr:npub1…` no texto (NIP-27), a lista aparece ao digitar `@` nos grupos e cada um vê o
  nome que conhece ("@~Bia" para quem não é contato, "@Você" destacado para quem foi mencionado), também na prévia
  da lista, na citação e ao copiar. *Achado no caminho:* a prévia da lista cortava no meio de uma menção; agora a
  menção conta como um nome curto. *Ficou de fora:* avisar quem foi mencionado (notificação ainda não existe) e
  mencionar no 1:1.
- **Cartão de perfil privado com nome e foto** (item 8, Q-P5, RF-02; testes `profile.test.ts` e e2e `perfil`). Escolhas
  do Pedro: o cartão leva nome, foto, versão/recursos do app e relays de DM (rejeitados: só nome e foto, ou sem os
  relays, que teriam de ganhar outro formato depois); vai a todos com quem já falei, no 1:1 e nos grupos (rejeitado: só
  1:1, que deixaria membros de grupo sem foto); o nome que dei ao contato vence o do cartão (rejeitado: o cartão
  sobrescrever); a foto de quem mandou pedido só aparece depois de aceitar (T9); e tudo num PR só, em vez de cartão e
  foto separados. Kind `4442` (o `4441` já era a confirmação), um embrulho por pessoa. A foto é o quadrado do meio
  (sem tela de recorte), 512 px, cifrada no Blossom, com a prévia de 96 px dentro do cartão. Em Ajustes, "Editar nome
  e foto" (`/ajustes/perfil`) é a primeira forma de mudar o próprio nome; os detalhes do contato mostram a foto. A tag
  `nome` na primeira mensagem continua, para versões antigas. *Ficou de fora:* tela para ajustar o recorte (testado pelo Pedro, que pediu para registrar em "Pedidos e ideias"), foto no
  convite/QR, a lista de recursos ainda não muda o que o app manda.

## 2026-10-28

- **Bug: queda de conexão no meio da autenticação deixava o app sem receber** (testes `sync.test.ts`). Achado ao
  investigar o teste instável "queda de conexão", que não era só carga: se a conexão com um relay caía enquanto o app
  respondia ao AUTH (NIP-42), a tentativa pendente ficava marcada como em andamento e a conexão seguinte a
  reaproveitava; ela esperava 2 s, falhava, e a assinatura de mensagens era descartada até outra reconexão. Em rede
  ruim de celular isso é comum. Agora a autenticação pendente é descartada junto com o socket que caiu. O guia
  `/teste` e o roteiro também foram atualizados para responder, reagir, entregue/lida, seleção e favoritas.
- **Seleção de várias mensagens** (item 6, RF-28; testes `interactions.test.ts` e e2e `selecao`). Pedido do Pedro em
  2026-10-26, movida do "Futuro" em 2026-10-27. O item "Selecionar" do menu da mensagem liga o modo (o toque longo
  continua abrindo o menu, para não tirar o que já existe); no modo, qualquer toque no balão marca ou desmarca e a
  barra do topo mostra a contagem e os botões Favoritar, Copiar (várias saem com `[hora] Nome: texto`), Encaminhar e
  Apagar ("para todos" só se todas são minhas). Decidido pelo Pedro: favoritos têm **estrela no balão** e a tela
  **Favoritas**, no menu ⋮ da tela inicial (que também leva a Ajustes); depois de validar no app, as favoritas de cada
  conversa também aparecem nos detalhes do contato e do grupo, e tocar numa delas abre a conversa rolada até a
  mensagem. É só local e não entra no backup por enquanto (o backup cifrado, item 10, decide). Apagar para todos manda
  um pedido por mensagem (não um único com todos os ids), mais simples e compatível com apps de terceiros. *Plano
  original, que mudou:* o toque longo iniciaria a seleção e o menu viraria a barra de ações; um único pedido cifrado
  com todos os ids.
- **Etapa 3 de UX/UI concluída** (item 7). Tamanho da letra em Ajustes: Normal 100%, Grande 120%, Muito grande 140%
  sobre o `html`, tudo em rem acompanha; a preferência é do aparelho, em `localStorage`, não da conta, para valer já
  na tela do PIN (e2e `tamanho-da-letra`). Nível do microfone durante a gravação: barra ao lado do tempo, em decibéis
  de -60 a -10 dB, lida do mesmo analisador que acha o começo da voz (e2e `medidor-do-microfone`). O aviso de sem
  conexão saiu em 2026-10-26.
- **Status de entrega e de leitura** (item 5, RF-50, 51; e2e `entrega-leitura`). Um tique = enviada, dois = entregue,
  dois coloridos = lida; no grupo vale o do membro mais atrasado. Só confirmo a quem já é contato (ou grupo aceito):
  pedido de mensagem não ganha sinal de que estou aqui (RF-12); ao aceitar e abrir a conversa, sai a "lida".
  Ajustes › Privacidade liga e desliga a leitura. Entregue: dois tiques na cor do texto; lida: dois tiques azuis
  (`--read`), porque o cinza e o verde se perdiam no balão.
- **Responder e reagir** (item 4, RF-22, 23; testes `interactions.test.ts` e e2e `responder-reagir`). Responder: item
  "Responder" no menu da mensagem; o campo mostra a citação e o balão sai com ela (toque leva à original, se está na
  tela). Vale só para texto; áudio e foto seguem como mensagem nova. Reagir: seis emojis no topo do menu
  (👍 ❤️ 😂 😮 😢 🙏); uma reação por pessoa e mensagem, a mais recente vale; chips sob o balão, e tocar no chip dá a
  mesma reação ou desfaz a minha. O "+" do menu abre o seletor com 48 emojis (lista só sugerida: o protocolo aceita
  qualquer reação curta).
- **Fotos: primeiro toque baixa** (RF-41, 71; pedido do Pedro). A foto desfocada baixa no primeiro toque (fica nítida
  no balão) e só o segundo a abre em tela cheia; o arquivo baixado fica no aparelho, então recarregar o app não traz o
  borrão de volta (antes só valia até fechar o app).
- **Miniatura da foto pequena demais** (e2e `fotos`; pedido do Pedro). A prévia (RF-41) era gravada com 48 px e o
  balão a mostra com ~256 px (`16rem`), então era esticada ~5 vezes e virava um borrão. Agora tem **96 px**
  (`THUMB_SIDE`), mantendo o teto de **5 KB** (RNF-24): medido no e2e com uma foto de ruído (caso ruim para JPEG),
  ficou em ~3,7 KB, e a lista de qualidades ganhou 0.2 para as fotos difíceis. O protocolo não muda (`thumb` continua
  aceito até 8000 caracteres), então clientes antigos leem as mensagens novas e o contrário também. Alternativa
  descartada: subir o teto de bytes. **Segunda rodada** (o Pedro ainda achou pequena na homologação): o problema
  também era o espaço. O balão de foto (`with-photo`) agora ocupa até 80% da largura da conversa (teto de 24 rem) com
  3 px de margem, como no WhatsApp, e a altura máxima subiu de 20 rem para o menor entre 30 rem e 60% da tela (foto
  muito em pé é cortada). A prévia esticada ainda é borrada; o que resolve de vez é baixar a foto sozinha (decisão em
  aberto no roadmap).
  - **Achado no caminho** (e2e `pedidos`, que falhava 2 de 3 vezes): o aviso de grupo ia para a fila de envio depois
    de uma busca solta dos relays de cada membro; recarregar a página logo depois de criar o grupo perdia o aviso e o
    membro nunca via o grupo. Agora `sendGroupChange` busca os relays de todos antes de devolver e põe os avisos na
    fila em seguida.
- **Contatos em abas: pedidos separados dos contatos** (e2e `pedidos`, `conversa` e `textos`; decidido pelo Pedro).
  A página empilhava "Pedidos de mensagem" e a lista com o mesmo estilo de linha, e um pedido (gente sem confiança)
  parecia um contato. Opções consideradas: tela própria de pedidos, abas, cartão na mesma página, linha na lista de
  conversas, cabeçalho fixo, pedidos recolhidos e só um banner. **Escolhida: abas "Contatos | Pedidos (N)".** (1) O
  número fica na aba, sempre visível; sem pedido, a aba continua lá, esmaecida e sem número, para a posição não pular;
  (2) o ponto do ícone de Contatos na tela inicial abre direto a aba Pedidos (`/contatos?aba=pedidos`); sem pedido,
  abre em Contatos, a aba padrão; (3) **Bloqueados (N)** ficam no fim da aba Pedidos, não numa terceira aba; (4)
  "Adicionar contato" e "Meu convite" ficam acima das abas; (5) pedidos de conversa e de grupo juntos, com o ícone de
  grupo para distinguir; (6) abas acessíveis (`tablist`, `tab`, `tabpanel`, setas do teclado). Segunda opção: linha
  "Pedidos" fixa no topo da lista de conversas, abrindo uma tela própria. **Achado no caminho** (corrigido, e2e
  `pedidos`): a página carregava pedidos e contatos só ao abrir, então um pedido que chegava com ela aberta só
  aparecia ao recarregar; agora recarrega junto com `session.version`, como a tela inicial.
- **Pedidos vindos de grupo** (testes `groups.test.ts` e e2e `pedidos`). Quem me põe num grupo sem ser contato
  aceito faz o grupo virar pedido, em Contatos junto dos pedidos de conversa, e não na lista; aberto, tem Aceitar e
  Bloquear, links em texto, áudio fechado e sem campo de mensagem, e o app **não se apresenta aos membros nem repassa
  avisos até aceitar** (T7). Bloquear bloqueia quem me adicionou, apaga as mensagens e descarta o que vier do grupo,
  sem aviso; o estado do grupo fica, para um aviso novo não o trazer de volta. Grupos que já existiam seguem normais.
  **Achado no caminho** (corrigido): a data do dia no topo (`updateFloatingDay`) desistia se o bloco ainda não estava
  desenhado; agora tenta nos quadros seguintes.
- **Chamadas de áudio e vídeo: dá para fazer?** (pergunta do Pedro, só para pensar; nada decidido). **Dá, sem mudar a
  arquitetura.** A mídia vai por WebRTC (já existe no navegador e no PWA), direto entre os aparelhos e cifrada
  (DTLS-SRTP); o Nostr serve só de **sinalização** (oferta, resposta e candidatos ICE) em mensagens NIP-17 efêmeras,
  que já têm cifra, remetente autenticado e canal entre os dois. Pesam: (1) **TURN**: ~20 a 30% das chamadas não
  conectam direto (redes móveis, CGNAT) e precisam de um servidor de retransmissão, que consome banda e foge de "sem
  custo de infraestrutura"; STUN público serve para o resto; (2) **o IP aparece** para a outra ponta (ICE), então só
  chamar contato aceito e oferecer "retransmitir sempre" (T a registrar); (3) **toque de chamada**: o PWA fechado não
  recebe a oferta a tempo sem push (o Web Push muda isso; no iPhone é pior); (4) o relay guarda a sinalização por
  pouco tempo (usar expiração NIP-40) e chamada em grupo exige malha ou servidor de mídia (SFU), então começar só 1:1.
  Ordem provável: áudio 1:1 antes de vídeo. Decidir antes: aceitar um TURN próprio ou de terceiros e seu custo, e o
  desenho do toque.

## 2026-10-27

- **Fotos e encaminhar sem reenviar** (item 3, RF-41, 42, 70, 71), em 3 partes. (1) Core: compressão por tentativas
  até 200 KB e lado de 1600 px, prévia de 48 px (96 px desde 2026-10-28) em até 5 KB dentro da mensagem, envio
  pendente com repetição como o áudio, `forwardOf` (encaminhar leva a mesma referência). (2) Tela: anexar da galeria
  (câmera na hora fica para depois), JPEG pelo canvas com orientação EXIF, prévia no balão com o espaço reservado pelo
  tamanho, baixar ao tocar e abrir em tela cheia, foto fechada nos pedidos de mensagem, e2e `fotos`. (3) Encaminhar:
  "Encaminhar" no menu da mensagem (texto, foto e áudio que já saíram), folha com contatos e grupos de que faço parte,
  mensagem nova com a mesma referência do arquivo, sem novo upload, e2e `encaminhar`. **Bug corrigido:** o seletor só
  aceitava uma foto e o app mandava só a primeira; agora escolher várias envia uma mensagem para cada (e2e `fotos`).
- **Internacionalização** (item 2, RNF-71, 72; [ADR-0008](adr/0008-internacionalizacao.md), Q-I1). Pedido do Pedro em
  2026-10-26; a ordem (antes das telas novas, porque cada uma acrescenta texto fixo) foi aprovada por ele. Antes, o
  português estava direto nos componentes Svelte, em `errors.ts`, em `teste.ts`, nas mensagens de erro do core, no
  guia e no roteiro; as datas usavam `pt-BR` fixo. Candidatos: Paraglide JS, svelte-i18n e um módulo próprio;
  escolhido Paraglide JS 2, só pt-BR por enquanto. Feito: todas as telas, as mensagens de erro, o guia `/teste` e o
  roteiro com os textos em `packages/app/messages/pt-BR.json`; plurais pela biblioteca; datas e ordem alfabética na
  língua da interface; o core não grava mais frases no banco (prévias e avisos de grupo, versão 5 do Dexie) e devolve
  códigos que a interface traduz; o e2e `textos` confere todas as telas numa pseudolíngua.
- **Segundo buraco de mensagem perdida ao recarregar** (teste `messaging.test.ts`). O traço da CI do e2e
  `excluir-conversa` mostrou o embrulho chegando duas vezes (a página recarregou na hora) e a conversa nunca
  aparecendo. Guardar a mensagem e criar a conversa são gravações separadas; se o app morre entre as duas, ao
  reprocessar a mensagem já existia e o código devolvia "já conhecida" sem criar a conversa. Agora mensagem conhecida
  sem conversa refaz o resto. Provavelmente é a mesma causa do `conversa` que falhou uma vez na CI.

## 2026-10-26

- **Pedidos de mensagem e bloqueio** (item 11 em parte, RF-12, 13; testes `requests.test.ts`, e2e `pedidos`;
  escolhas do Pedro, que pediu para antecipar depois que a conta "Testadora" do e2e apareceu na lista dele). Quem
  escreve sem ser contato vira **pedido**: a conversa não entra na lista; um **ponto simples no ícone de Contatos**
  avisa que há pedido (sem número, sem notificação, como o Instagram). Abrindo o pedido: banner com **Aceitar** e
  **Bloquear**; links ficam texto (T18) e áudio não é baixado nem toca. **Aceitar** vira contato e a conversa passa
  para a lista (e abre a tela da frase, como o convite). **Bloquear** (também na tela do contato) apaga a conversa do
  aparelho e **descarta o que vier dessa chave**, no 1:1 e nas mensagens de grupo (os avisos de grupo continuam
  valendo); sem aviso a quem foi bloqueado. **Desbloquear** volta a deixar escrever e, se escrever, cai nos pedidos;
  as mensagens de antes não voltam. Ficou de fora a prova de trabalho (RF-90, T8).
- **Excluir conversa** (testes `messaging.test.ts` e e2e `excluir-conversa`; escolhas do Pedro). Toque longo ou botão
  direito na conversa da lista abre a confirmação. Somem a conversa, as mensagens e os arquivos que mais ninguém usa,
  só deste aparelho e sem aviso a ninguém; o contato fica e mensagem nova recomeça a conversa (sem as antigas). Envio
  de arquivo que ainda sobe é cancelado antes. **Grupos: só depois de sair** (apagar um grupo ativo perderia o estado
  dele e descartaria as mensagens novas).
- **Onboarding sem a frase no cadastro** (e2e `identidade.spec.ts`; Q-U1, RF-03, 04, T19). Copiar e guardar 12
  palavras no cadastro era contraintuitivo. Agora o cadastro é só nome e PIN, e a pessoa entra direto. A frase é
  pedida **ao ganhar o primeiro contato** (por convite, QR, "Adicionar aos contatos" ou aceitando um pedido): a tela
  "Guarde sua frase de recuperação" aparece uma vez, com **Guardar agora** (PIN, frase, "Guardei" e conferir 2
  palavras) e **Depois**. "Depois" adia o aviso da tela inicial por 3 dias (1 com risco alto), e o aviso só aparece
  com algum contato. Risco aceito: perder a conta antes de guardar a frase (T19). Não escolhidos (podem voltar):
  salvar a frase no Gerenciador de Senhas do Google com 1 toque (`PasswordCredential`, só Chrome) e conferir tocando
  na palavra certa entre 4. Passkey (Q-A6) adiada para depois do domínio próprio (Q-N1).
- **Endereços de páginas viram links** (testes `links.test.ts` e e2e `links`; T9, T18). `splitLinks` (core) acha
  `http(s)://` e `www.`; endereço com usuário (`banco.com@outro.com`), sem ponto no domínio ou de outro esquema fica
  texto; pontuação no fim não entra; o domínio aparece inteiro (em punycode se tiver letras parecidas) e só o resto é
  encurtado; abre em aba nova com `noopener noreferrer`, **sem prévia** (buscar a página mostraria o IP). Escolha do
  Pedro: contato abre direto; pedido de desconhecido continua texto até aceitar; em grupo, membro que não é contato
  mostra o aviso "Abrir domínio?" (Cancelar/Abrir). Minhas mensagens sempre abrem direto.
- **Áudio: envio com cara de lento** (e2e `audio-sem-rede`). Antes, `sendAudio` só mostrava a mensagem depois de
  cifrar e subir o arquivo para os dois Blossom, com "Enviando áudio…" no lugar do balão, e a falha perdia o áudio.
  Agora o balão aparece na hora, já tocável, com um indicador de enviando. Decidido pelo Pedro: tentar por **minutos,
  não horas**, com espera que dobra a cada falha (2 s, 4 s, 8 s… até 60 s) e sorteio entre a metade e o total;
  passados 5 minutos desiste, e o balão mostra "Não foi possível enviar" com **Tentar de novo** e **Apagar**. Sem
  mudar o esquema do banco: o estado vai em `upload` no registro da mensagem e numa lista nas configurações; o balão
  provisório (id `envio:…`) é trocado pela mensagem de verdade quando o envio termina, e as tentativas são retomadas ao
  abrir o app ou voltar a rede. Apagar o balão que não saiu cancela o envio.
- **Áudio: silêncio no começo** (testes `voice-start.test.ts` e e2e `audio-inicio`). Caminhos considerados: (a) cortar
  o começo sem recodificar, com um deslocamento na mensagem; (b) abrir o microfone antes, ao tocar no campo; (c)
  detectar e cortar ao enviar, recodificando. Escolhido (a) com detecção ao gravar: o app lê o nível do microfone em
  janelas de ~20 ms (`VoiceStartDetector`), acha onde a voz começa (5 janelas seguidas acima de 3× o ruído de fundo e
  de um mínimo) e guarda o ponto, com 0,3 s de folga, na tag `start`; o player começa dali, e a barra continua inteira
  para voltar ao começo. Menos de 0,6 s não pula; na dúvida não corta. O arquivo não é recodificado. **Achado no
  caminho:** a barra do player não deixava arrastar áudios gravados no navegador, porque o Chrome os entrega com
  duração infinita; agora basta o áudio ser `seekable`.
- **Aviso de sem conexão** (e2e `sem-conexao`). Pílula acima do campo de mensagem quando o aparelho fica sem internet,
  na hora, ou sem nenhum relay conectado por 6 s; some sozinha quando volta. No mesmo dia virou uma faixa fina presa
  no topo, no fluxo da página (a conversa encolhe o mesmo tanto), porque a pílula no meio atrapalhava.
- **Bug: mensagem "sumia" ao adicionar alguém com os relays fora do ar** (e2e `envio-sem-rede`). No envio 1:1, a busca
  de onde o contato recebe (`deliveryRelays`, até ~10 s por relay fora do ar) rodava **antes** de guardar a mensagem;
  o campo já estava limpo e nada aparecia, e se a busca falhava ou a pessoa saía da tela, a mensagem se perdia.
  Correção: a mensagem é guardada como "pendente" primeiro e os relays são buscados depois (RNF-12). Sem para onde
  enviar (`NoRelaysError`), ela é removida e o texto volta ao campo.
- **Bug: mensagem perdida se o app fecha ou recarrega enquanto ela chega** (teste `sync.test.ts`). Achado numa falha
  da CI do e2e `excluir-conversa`. O motor marcava o embrulho como "visto" **antes** de abri-lo e guardar a mensagem;
  se o app morresse nesse meio-tempo (comum no celular), a próxima sincronização o ignorava para sempre. Agora o
  embrulho só é marcado depois de processado (o inválido também); processar duas vezes é seguro porque guardar a
  mensagem já dedupa pelo id.
- **Bug: fila de envio fora de ordem e lenta depois de ficar offline** (testes `sync.test.ts`). O Pedro mandou 4
  mensagens sem internet e a primeira saiu mais de 1 minuto depois das outras. A fila tentava mesmo sem internet e a
  espera crescente ficava maior na que falhou primeiro. Agora a fila sai na ordem em que as mensagens foram escritas
  (`queuedAt`); sem internet espera sem gastar tentativas; ao voltar, a espera é esquecida e tudo sai já, em lotes de
  5. O e2e `envio-sem-rede` confere as 4 mensagens offline, mas quem pega o bug antigo são os testes do motor.
- **Bug: promoção de administrador perdida** (teste `groups.test.ts` e e2e `grupos`). Um aviso de grupo chegando pela
  rede junto com uma ação da pessoa na tela fazia a gravação mais lenta apagar a outra. Agora as gravações da conversa
  esperam a vez, uma por banco (`conversations/lock.ts`). E2e de grupos repetido 30 vezes sob carga, sem falha.
- **"Testadora" na lista do Pedro** (#12). O e2e "Enviar comentário" mandava, a cada rodada, uma mensagem de verdade
  para a conta de comentários pelos relays reais. A suíte agora desvia todo WebSocket que não é local para o relay
  local (`ajudantes.ts`, `desviados`), e o teste confere o desvio.
- **Velocidade da suíte e2e medida** (nada feito; vai para o M5). ~58 s no Mac (8 núcleos, 26 testes, ~155 s
  somados); na CI, 99 s de suíte com 2 workers e ~2 min no job inteiro. Mais lentos: `envio-sem-rede` 35 s,
  `audio-inicio` 15 s, `grupos` 14 s, `audio` 11 s, `audio-sem-rede` 9 s, `apagar` 8 s. O que mais atrasa os PRs é a
  fila do Actions e a instabilidade, não a suíte.

## 2026-10-22

- **Repriorização do MVP** pelo critério do **uso no dia a dia** (escolha do Pedro). Grupos (RF-30..33) adiantados do
  M3 para o M2, porque são o uso principal no Brasil e mudam a tela da conversa; o cartão de perfil e a etapa 3 de UX
  passaram para o M3; o modo foco (RF-52, 60–62), a entrega em lotes (RF-63) e a expiração de mídia com o painel de
  armazenamento (RF-72, 73) foram para a v1.
- **Suíte e2e** ([ADR-0006](adr/0006-fluxo-de-trabalho-e-releases.md); `packages/e2e`, Playwright no Chrome
  instalado, relays e Blossom locais, só pelo rótulo `e2e-tests`), em 5 partes no mesmo dia: (1) cadastro e PIN com
  recuperação, conversa entre duas pessoas, tela da conversa com balões e teclado, ~10 s; (2) áudio e apagar para
  todos e para mim, com dois Blossom locais em https; (3) grupos com quatro pessoas; (4) contatos e QR, "Mensagens
  novas", data no topo, e um bug corrigido: a conversa com não lidas às vezes abria no topo; (5) copiar, guia,
  "Enviar comentário", aviso de versão nova e autocorreção da tela branca.
- **Homologação** ([ADR-0007](adr/0007-homologacao.md)): organização `lerolero-app`,
  https://lerolero-app.github.io/lerolero/, workflow `homologacao.yml`, release a partir do `commit.txt`, moldura
  laranja "Homologação". A skill `publicar` ganhou a regra de versão.
- **Grupos** (RF-30..33): core, tela (avisos na conversa e nome de quem escreveu nos balões) e gestão (detalhes ao
  tocar no nome do grupo, membros e papéis, adicionar, remover, promover e rebaixar, renomear e sair; cada ação só
  para quem tem permissão).
- **Etapas 1 e 2 de UX/UI.** Tela inicial com a lista ocupando a tela, ícones de Contatos e Ajustes, botão flutuante,
  avatares com iniciais e estado vazio. Conversa: balões seguidos agrupados com a pontinha só no último, data do dia
  no topo ao rolar, botão "ir para o fim" com o número de novas e linha "Mensagens novas", "Copiar" no menu com
  vibração curta.
- **Blossom, áudio e exclusão.** Áudio em Opus (Q-R2 resolvida), apagar mensagens e áudios para mim e para todos
  (pedido cifrado ao contato e remoção do arquivo dos Blossom por quem enviou).
- **Ajustes depois de usar o app:** recarregar sem pedir o PIN se o app foi usado nos últimos 5 minutos (T16); áudio
  de ~17 para ~28 kbps, porque em lugar barulhento a voz ficava ruim. O controle automático de volume cortava a voz no
  começo e foi desligado. Conferido: a hora mostrada já é a do envio.
- **Bug: o teclado escondia as mensagens numa conversa curta** (e2e `tela-da-conversa.spec.ts`). No Chrome do Android
  o teclado só encolhia a parte visível e o navegador empurrava a página para cima. Agora a meta viewport pede
  `interactive-widget=resizes-content`, as mensagens ficam junto do campo e a conversa que estava no fim continua no
  fim.
- **Bug: mensagens no mesmo segundo fora de ordem** (`messaging.test.ts`). O horário do Nostr é em segundos e o
  empate era decidido pelo id. Agora cada mensagem sai datada depois da última da conversa (no máximo 60 s à frente).
  Faltava um caso: a primeira mensagem para alguém novo espera a busca dos relays e a segunda pegava o mesmo segundo;
  agora os envios saem em fila (`prototipos/e2e-rascunho/novas.mjs`).

## 2026-10-16 a 2026-10-22

- **M0:** monorepo, CI, licença e PWA publicados; protótipo de medição rodado num celular intermediário (não o de
  referência); lista provisória com 7 relays aptos.
- **M1:** identidade com frase e PIN, contatos por QR e convite, texto por NIP-17, motor de sincronização, banco
  Dexie. Ritmo real: de 16 a 22/10 saíram M0 (menos as esperas), M1, quase todo o M2 e os grupos, o equivalente a ~15
  semanas das estimativas (Q-M1).
