# Histórico de entregas

Como cada item do [roadmap](07-roadmap.md) ficou pronto: o que foi feito, as escolhas do Pedro, as alternativas
descartadas, os bugs achados no caminho e o que ficou de fora. O roadmap guarda só o plano e o estado; o detalhe vem
para cá, com a entrada mais recente no topo. Os limites que continuam valendo também estão no roadmap, em "Limites
conhecidos".

## 2026-10-29

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
