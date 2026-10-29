# 06 — Protocolo e dados

- **Status:** ✅ aprovado
- **Última atualização:** 2026-10-22

Formatos concretos das mensagens na rede e dos dados guardados no aparelho. Base: [ADR-0001](adr/0001-protocolo-de-transporte.md) (Nostr), [ADR-0003](adr/0003-armazenamento-local.md) (IndexedDB) e [ADR-0004](adr/0004-midia.md) (mídia).

## 1. Princípios do protocolo

1. **Padrão primeiro:** usar NIPs existentes sempre que houver um, para manter a interoperabilidade com outros apps Nostr.
2. **Extensões compatíveis:** recursos próprios entram como **tags extras** (que outros apps ignoram) ou como **kinds próprios** com tag `alt` (NIP-31), que traz um texto legível para apps que não os entendem.
3. **Tudo embrulhado:** todo evento entre usuários (mensagens, reações, confirmações, controle de grupo) trafega dentro de um gift wrap (NIP-59). Nada de conversa privada é publicado em claro.
4. **Versionado:** eventos próprios levam a tag `["v", "1"]`; versões futuras devem continuar lendo versões anteriores (RNF-93).

## 2. Identidade e chaves

| Item | Especificação |
|---|---|
| Par de chaves | secp256k1 (padrão Nostr) |
| Frase de recuperação | BIP-39, 12 palavras **sorteadas pelo app** (nunca escolhidas pela pessoa: frases inventadas são previsíveis e podem ser quebradas em massa, sem precisar do aparelho; decidido em 2026-10-22), **lista oficial em português**. O app orienta guardar num papel em lugar seguro ou num gerenciador de senhas, e oferece copiar com aviso sobre o histórico do teclado e a nuvem, limpando a cópia após 1 minuto. Atenção: no BIP-39 a chave é derivada das próprias palavras, então a mesma frase em outra língua gera **outra chave**. Para usar a identidade em outro app Nostr, o caminho é exportar a chave privada (opção avançada) |
| Derivação | NIP-06: caminho `m/44'/1237'/0'/0/0` |
| Proteção no PWA | Chave privada cifrada com AES-GCM; a chave de cifra vem do **PIN** via **Argon2id** (parâmetros mínimos recomendados pela OWASP: 19 MiB de memória, 2 iterações, paralelismo 1; ajustar para ~1 s no aparelho de referência) |
| Proteção no nativo | Cofre do sistema (Android Keystore, Keychain etc.); PIN opcional |
| PIN | **6 dígitos** (decidido em 2026-10-22). Familiar para o público leigo; a força vem do Argon2id calibrado e do limite de tentativas ([T14 e T15](02-modelo-de-ameacas.md)). Esquecer o PIN: digitar a frase cria um PIN novo no mesmo aparelho, sem perder as conversas. A frase pode ser vista de novo nos ajustes, pedindo o PIN |
| Nome de exibição | **Privado** (decidido em 2026-10-22): **não** publicamos perfil (kind `0`). O nome vai só dentro do convite/QR e das mensagens cifradas, então só os contatos ligam a chave a um nome. Outros apps Nostr mostram apenas a chave |
| Convite (QR e link) | Leva a chave pública e o nome de quem convida. Formato: `<endereço do PWA>/convite#<npub>&n=<nome>` (~120 caracteres), em que o `npub` (NIP-19) é entendido por outros apps Nostr e o nome vai à parte. Os relays de DM **não** vão no link: quem recebe busca o kind `10050` publicado pelo app, com a lista padrão de reserva (decidido em 2026-10-22; com os relays, o link tinha ~330 caracteres e o QR ficava denso). Convites antigos com `nprofile` (chave + relays) continuam aceitos. Os dados ficam depois do `#`, que não chega ao servidor. O QR contém o próprio link, então a câmera comum do celular também abre o app. Ao adicionar, a pessoa escolhe o nome local (RF-14), com o nome do convite só como sugestão. Até a Q-N1 (domínio), o endereço é o do GitHub Pages: **links criados antes do domínio deixam de funcionar quando ele mudar**, então a Q-N1 precisa estar decidida antes do beta |
| Relays de DM | Publicados em um evento kind `10050` com 1 a 3 relays (recomendação do NIP-17) |

## 3. Mensagens na rede

### 3.1 Envelope (NIP-17 / NIP-59)

```
kind 1059  Gift wrap — assinado por chave descartável; tag ["p", <destinatário>]
 └─ kind 13  Selo — assinado pelo remetente real; conteúdo cifrado (NIP-44)
     └─ rumor (evento sem assinatura) — o conteúdo de fato
```

- O remetente cria **um gift wrap por destinatário**, mais **um para si mesmo** (para ter a própria cópia em outros aparelhos e no backup).
- `created_at` do gift wrap e do selo é embaralhado em até 2 dias para trás (NIP-59). O horário real fica só no rumor.
- NIP-44 v2 já faz o padding do conteúdo (T2, RNF-43).

### 3.2 Tipos de rumor

| Uso | Kind | Padrão | Observações |
|---|---|---|---|
| Mensagem de texto | `14` | NIP-17 | Menção (RF-35): `nostr:npub1…` no texto (NIP-27), a chave e não o nome; cada um mostra o nome que conhece. Resposta: tag `["e", <id do rumor citado>, "", "reply"]` (marcador do NIP-10). Tags próprias: `seq`, `g` (ver abaixo) e `["nome", <nome>]` na primeira mensagem de cada conversa: como o nome é privado, ele chega ao contato só dentro da mensagem cifrada |
| Mídia (foto, áudio) | `15` | NIP-17 | Tags do NIP-17 para arquivos: `file-type`, `encryption-algorithm` (`aes-gcm`), `decryption-key`, `decryption-nonce`, `x` (hash do arquivo cifrado), `ox` (hash do original), `size`, `dim`, `thumb` (prévia), URLs do Blossom. Foto: `dim` é `LARGURAxALTURA` em pixels e `thumb` é um JPEG de até ~5 KB em base64, no próprio texto da tag; quem recebe descarta `thumb` com mais de 8000 caracteres ou fora do base64 e `dim` que não seja dois números (decidido em 2026-10-27: sem `blurhash`, a prévia já é uma imagem de verdade, e o balão reserva o espaço antes de baixar). Encaminhar manda a mesma referência (URLs, chave, nonce e hashes) numa mensagem nova, sem baixar nem subir de novo (RF-70). Áudio: `duration` (segundos) e `start` (segundos de silêncio no começo, que o player pula; só vale se for maior que 0 e menor que `duration`; cliente que não conhece a tag toca o áudio inteiro, então não muda `SYNC_GENERATION`) |
| Reação | `7` | NIP-25 | Tag `["e", <id do rumor>]` e `["k", <kind>]`; conteúdo = emoji (até 16 caracteres). Uma por pessoa e mensagem: a mais recente vale. Desfazer = pedido de apagar (kind `5`) citando o id da reação, só de quem a escreveu |
| Apagar para todos | `5` | NIP-09 | Pedido de apagamento; outros apps podem ignorar (RF-25) |
| Edição | `4443` | próprio | Decidido em 2026-10-29 (RF-24): conteúdo = texto novo inteiro; tags `["e", <id original>]`, `["k", "14"]`, `alt` e, nos grupos, `g`. Só texto e só de quem escreveu, até 15 minutos depois da original (com 1 minuto de folga para o relógio); a mais nova vale. Vai a todos da conversa e à minha cópia; quem recebe mostra "editada" e não guarda o texto antigo. Edição que chega antes da mensagem espera por ela (até 200) |
| Confirmação (entregue / lida) | `4441` | próprio | Uma tag `["e", <id>]` por mensagem (até 200), `["status", "entregue" ou "lida"]` e `alt`. Vai só a quem escreveu as mensagens (nos grupos também), sem cópia para mim. Seção 3.4 |
| Controle de grupo | `4440` | próprio | Seção 3.3; tag `alt` "aviso de grupo do Lero-lero" |
| Cartão de perfil | `4442` | próprio | Seção 3.10 |
| Pedido de reenvio | `4444` | próprio | Decidido em 2026-10-29 (RF-53): uma tag `["seq", <n>]` por número que falta (até 50), `alt` e, nos grupos, `g`. Vai só a quem escreveu, sem cópia para mim. Seção 3.5 |

Os números dos kinds próprios devem ser escolhidos consultando o registro de kinds do repositório de NIPs, para evitar colisão (Q-P1). A faixa **4440–4449** fica reservada para os kinds próprios do Lero-lero (livre no registro em 2026-10-22).

### 3.3 Grupos

O NIP-17 define uma conversa pelo **conjunto de participantes** (tags `p`), com nome opcional pela tag `subject`. Isso não basta para RF-31 (adicionar/remover membros, administrador), então usamos uma convenção por cima:

- Cada grupo tem um **identificador aleatório** na tag `["g", <id>]`, presente em todo rumor do grupo. Assim o grupo mantém a identidade quando os membros mudam.
- Cada membro guarda a lista atual de membros; mensagens são embrulhadas só para ela (mais a cópia para si). Membro removido simplesmente deixa de receber embrulhos (RF-32). Quem entra não recebe as mensagens anteriores.
- Limite: **20 membros** (RF-30).
- Apps que não entendem a tag `g` veem uma conversa NIP-17 comum entre os mesmos participantes.

**Papéis e permissões** (decidido pelo Pedro em 2026-10-22):

| Ação | Quem pode |
|---|---|
| Mandar mensagens, sair do grupo | Qualquer membro |
| Adicionar membros, renomear o grupo, promover a administrador | Administradores (o criador também é administrador) |
| Remover membro comum | Administradores |
| Remover um administrador ou tirá-lo da função | Só o criador |
| Remover o criador | Ninguém |

- **O criador sai:** o título de criador passa ao **administrador mais antigo** no grupo; sem outros administradores, ao **membro mais antigo**. Assim o grupo sempre tem um criador. A regra é fixa, e não um sorteio como no WhatsApp, porque não há servidor: cada aparelho precisa chegar sozinho ao mesmo resultado. Empate de antiguidade: menor chave pública.
- Considerado e não adotado: qualquer administrador tirar outro (como no WhatsApp). O Pedro preferiu deixar isso só com o criador. Risco aceito: se o criador perder a identidade sem sair do grupo, ninguém mais tira um administrador problemático.

**Eventos de controle** (rumor kind `4440`, tag `g`, `["v", "1"]` e `alt`):

- Ação na tag `["acao", <ação>]`: `criar`, `adicionar`, `remover`, `sair`, `renomear`, `promover`, `rebaixar`, `apresentar`. Quem é afetado vai em `["alvo", <chave>]`; o novo nome, em `subject`.
- Cada aviso leva **só a mudança**, não a lista inteira (decidido em 2026-10-22, depois de achar o problema): se dois administradores mexem ao mesmo tempo (Alice adiciona Dave enquanto Bob remove Carol), as duas mudanças se somam. Com a lista inteira em cada aviso, uma apagava a outra em silêncio.
- A **lista completa** (nome, membros com horário de entrada e papel) vai só na criação e no aviso que adiciona alguém, para quem entra ter de onde partir.
- O autor é o do selo (assinado). Cada aparelho guarda os avisos e refaz o estado aplicando-os em ordem de horário do rumor (empate: menor id), e **só aceita a mudança se o autor tinha permissão** naquele momento; senão, descarta.
- O ponto de partida é a criação ou, para quem entrou depois, o **primeiro aviso que chegou** ao aparelho e o adiciona, feito por um administrador. Assim um ex-membro não impõe um estado falso com horário antigo a quem acabou de entrar. Quem é readicionado parte da lista que veio no aviso, porque não recebeu o que mudou enquanto estava fora.
- **Avisos e mensagens no mesmo segundo** (decidido em 2026-10-22): o horário do rumor tem resolução de segundos e o empate é pela menor id, que é aleatória. Por isso o app data cada aviso novo **depois do último registro da conversa** (mensagem ou aviso), no máximo 60 s à frente do relógio do aparelho. Assim duas mudanças feitas em seguida (ex.: adicionar e já promover a mesma pessoa) valem na ordem em que foram feitas; o limite de 60 s evita herdar o relógio adiantado de outra pessoa. **Vale também para as mensagens** (1:1 e grupo, desde 2026-10-22): duas mensagens mandadas no mesmo segundo apareciam trocadas, para quem enviou e para quem recebeu (`sendTime` em `conversations/messaging.ts`). Uma mensagem pode então mostrar um horário até alguns segundos à frente do real. Os envios saem **em fila** (cada um depois de o anterior ficar gravado): a primeira mensagem para alguém espera a busca dos relays dele, e sem a fila a segunda pegava o mesmo segundo.
- O horário de entrada de quem entra é o horário do próprio aviso. Assim ninguém forja antiguidade para herdar o título. O herdeiro do criador é calculado em cada aparelho, não escolhido por quem sai.
- **Aviso com horário falso** ([T17](02-modelo-de-ameacas.md), decidido pelo Pedro em 2026-10-22): o aviso de quem perdeu o papel de administrador (removido, rebaixado ou saiu) não vale se tem horário de antes da perda mas **chegou depois** dela.
- **Repasse:** um aviso não chega a quem o autor ainda não sabia que estava no grupo (ex.: Bob remove Carol enquanto Alice adiciona Dave). Quando o app do autor vê o membro novo, reenvia a ele o aviso original, com o mesmo horário, se foi feito até 1 dia antes da entrada dele. Quem entrou aplica esses avisos logo depois da lista que recebeu, menos `renomear` (o nome da lista é mais novo).
- Cada aviso que vale aparece na conversa ("Ana adicionou Bruno"), com os nomes como cada um conhece as pessoas.
- O aviso vai para os membros de antes e de depois da mudança, para que quem saiu ou foi removido veja "Você foi removido" e pare de enviar.
- Mensagens de grupo só valem de quem é ou já foi membro. Se chegam antes do aviso que me pôs no grupo (os embrulhos chegam em qualquer ordem), ficam guardadas e entram quando ele chegar.
- **Nomes dos membros** (decidido em 2026-10-22): cada membro manda o **próprio nome**, cifrado, só para o grupo, com a ação `apresentar`, ao entrar e ao receber a notícia de um membro novo (este último envio só para quem entrou). Por garantia, a primeira mensagem de cada um no grupo também leva a tag `nome`, caso a apresentação se perca. Quem não está nos contatos aparece como "~Nome", com a opção de adicionar. Entrar num grupo mostra o seu nome a todos os membros, como no WhatsApp.

### 3.4 Status de entrega

| Status | Quem gera | Quando |
|---|---|---|
| Pendente | Remetente (local) | Mensagem salva, ainda não publicada |
| Enviada | Remetente (local) | Ao menos um relay confirmou (`OK`) |
| Entregue | Destinatário | Ao decifrar a mensagem, publica confirmação `entregue` |
| Retida em modo foco | Destinatário | Em vez de `entregue`, se ele permitir mostrar o estado (RF-52) |
| Lida | Destinatário | Ao exibir a mensagem, se a confirmação de leitura estiver ligada (RF-51) |
| Possivelmente perdida | Remetente (local) | Sem confirmação de alguém em 7 dias desde o envio ou o último reenvio (seção 3.5) |

Só vale a confirmação de quem está na conversa e só para mensagem minha. Sem a leitura ligada, a "lida" dos outros conta como "entregue". Quem recebe um pedido de mensagem (ainda não é contato) não confirma nada. Confirmações são **agrupadas**: um único evento pode confirmar várias mensagens de uma vez (lista de tags `e`), para economizar dados. Quem desliga a confirmação de leitura também não processa as dos outros.

### 3.5 Detecção de perdas (Q10 da Visão)

Usamos as duas ideias:

1. **Numeração por conversa:** cada remetente numera suas mensagens em cada conversa com a tag `["seq", "<n>"]`. O destinatário que recebe `n` e `n+2` sabe que falta `n+1`. Como os horários são embaralhados e os relays podem entregar fora de ordem, ele espera uma janela (ex.: até a próxima sincronização completa) antes de concluir que houve perda. Então envia um **pedido de reenvio** com os números faltantes, e o remetente reenvia a partir da cópia local.
2. **Prazo do remetente:** sem confirmação em 7 dias, a mensagem vira "possivelmente perdida", com botão para reenviar. Só funciona se o destinatário enviar confirmações.

A numeração funciona mesmo com confirmações desligadas e detecta perdas no modo Pausar.

Decidido em 2026-10-29 (item 12 do roadmap):

- **O remetente reenvia sozinho** ao receber um pedido de reenvio, a partir da cópia local, sem perguntar. Rejeitado:
  marcar a mensagem e esperar o toque do remetente, porque o pedido já mostra que a mensagem não chegou.
- **Nos grupos**, a mensagem vira "possivelmente perdida" quando algum membro não confirma em 7 dias, e o "Reenviar"
  manda só para quem não confirmou. Rejeitado: reenviar a todos, que gasta dados de quem já recebeu.
- **Quem recebe não vê nada** quando o app nota o buraco e pede o reenvio; a mensagem só aparece quando chega.
  Rejeitado: um aviso na conversa ("1 mensagem ainda não chegou"), que preocupa sem a pessoa poder fazer nada.
- O reenvio leva o **mesmo rumor** (o mesmo id), num embrulho novo: quem já tinha a mensagem descarta a repetida.
  Por isso as minhas mensagens de texto e de arquivo guardam o rumor no aparelho; as de antes desta versão não têm e
  nunca ficam "possivelmente perdidas".

Como ficou:

- **Numeração:** só texto e arquivo (kinds 14 e 15) levam `seq`; edição, reação, confirmação e pedido de apagar não.
  O número é o seguinte ao maior que qualquer aparelho meu já usou na conversa (as minhas cópias também contam);
  dois aparelhos sem internet ao mesmo tempo podem repetir um número, o que só tira a chance de achar um buraco ali.
- **Buraco:** o primeiro número visto de cada pessoa não cria buraco (pode ser de antes de restaurar a conta ou de
  entrar no grupo). Um salto maior que 50 guarda só os 50 mais próximos.
- **Janela (Q-P3):** o pedido sai quando o número falta há **30 segundos**; o app confere a cada 15 s. Se a mensagem
  não vier, pede de novo um dia depois, até **3 vezes**, e desiste depois de 7 dias. Pedir cedo demais só custa uma
  repetida. Pedido só a contato ou ao grupo que aceitei, como as confirmações (RF-12).
- **Quem enviou** reenvia só o que ainda tem, que não apagou, e a quem estava na mensagem (tags `p`), no máximo uma
  vez por hora para cada pessoa e mensagem. Para quem ainda não me escreveu, o reenvio leva a prova de trabalho.
- *Limite:* a edição (kind 4443) não é reenviada; quem recebe a mensagem pelo reenvio vê o texto original.

### 3.6 Mídia (Blossom)

1. Comprimir (foto: lado maior 1600 px, ≤ 200 KB; áudio: Opus ~16 kbps).
2. Calcular `ox` = SHA-256 do arquivo comprimido original.
3. Gerar chave e nonce aleatórios; cifrar com AES-GCM; calcular `x` = SHA-256 do arquivo cifrado.
4. Enviar para **2 servidores Blossom** (autorização Blossom assinada pelo usuário).
5. Publicar rumor kind `15` com URLs, chave, nonce, `x`, `ox`, tamanho, dimensões e prévia (≤ 5 KB).

**Deduplicação:** o cache local é indexado por `ox`. **Encaminhar** reutiliza URL, chave e `x` já existentes: nenhum envio novo.

### 3.7 Backup cifrado (RF-06)

- Evento kind `30078` (NIP-78, dados de aplicativo) com tag `["d", "<app>/backup"]`, conteúdo cifrado com NIP-44 **para a própria chave**.
- Contém: o próprio perfil (nome e a referência da foto no Blossom), contatos (chave, nome local, estado), grupos (id, membros, administradores, nome), configurações (modo foco, confirmações, expiração de mídia, relays).
- **Não contém** mensagens, mídia nem favoritas (decidido em 2026-10-29: texto de conversa nos relays sem prazo ampliaria a T11; o NIP-44 cifra no máximo ~64 KB).
- Configurações no backup: confirmação de leitura e relays onde recebo. O tamanho da letra é do aparelho.
- Publicado nos relays gerais e nos de DM do usuário, 5 s depois da última mudança e só se o conteúdo mudou (para economizar dados); republicado a cada 3 dias, para não sumir de relay que apaga eventos antigos.
- **Nunca sobrescrever às cegas:** o aparelho só publica depois de saber se há backup nos relays (achou e juntou, ou algum relay respondeu que não há). Restaurar sem rede adia a publicação até a busca dar certo.
- **Restaurar:** depois da frase e do PIN o app busca o backup; achou, aplica e entra sem pedir o nome. Contato que a sincronização já trouxe como pedido volta ao estado do backup; o que foi decidido no aparelho novo prevalece. Grupo restaurado vira o ponto de partida do estado (ação local `restaurar`, que não chega pela rede), e os avisos seguintes valem sobre ele.

### 3.8 Antispam (RF-90)

- **Quem envia:** o gift wrap leva prova de trabalho (NIP-13, tag `nonce` no kind 1059) em tudo que vai para alguém de quem ainda não recebi nenhuma mensagem, e nos avisos de grupo que põem essa pessoa num grupo. Só "a primeira mensagem" não bastava: quem envia não sabe se o outro já o aceitou, e a segunda sairia sem prova. Calculada no worker, com dificuldade calibrada para < 1 s no aparelho de referência (RNF-18); **14 bits**, pela medição no Motorola Edge 60 do Pedro em 2026-10-29 (10 provas de cada: 12 bits, média 61 ms e pior 178 ms; 14 bits, 196 ms e 806 ms; 16 bits, 870 ms e 4,9 s; rejeitado 16, fora da meta). A medição fica em Ajustes no app em dev, para repetir no aparelho de 2 GB.
- **Quem recebe:** não dá para descartar sem decifrar, como estava escrito: o remetente só aparece depois de abrir o embrulho (abrir custa bem menos que a prova). Aberto, se quem escreveu não é contato nem está num grupo comigo e o embrulho não tem a dificuldade mínima, a mensagem vai para "Pedidos de mensagem" (RF-12) numa seção **"Possível spam"**, sem ponto nem contagem (decidido em 2026-10-29). Rejeitado: descartar, porque quem estiver numa versão antiga ou em outro app Nostr não conseguiria mais começar conversa; e descartar depois de uma transição. Com prova, segue para Pedidos como hoje.

### 3.9 Sincronização

- **Assinatura:** `{"kinds": [1059], "#p": [<minha chave>], "since": <cursor − 2 dias>}` em cada relay de DM, com autenticação NIP-42 quando o relay exigir.
- **Cursor por relay:** maior `created_at` processado; a margem de 2 dias compensa o embaralhamento de horário.
- **Deduplicação:** guardar os ids de gift wraps processados por 9 dias (7 de retenção + 2 de margem) e descartar repetidos.
- **Fila de envio:** eventos prontos ficam na fila até ao menos um relay confirmar; novas tentativas com espera crescente (RNF-33).

### 3.10 Cartão de perfil (Q-P5, RF-02)

Decidido em 2026-10-29. O nome e a foto não ficam num perfil público (kind `0`): vão num rumor kind `4442`, embrulhado
como uma mensagem 1:1 (NIP-59), **um embrulho por pessoa**, para ninguém ver a lista de quem mais recebeu.

- Tags: `["v", "1"]`, `["nome", <nome>]` (obrigatória), até 3 `["relay", <wss://…>]` (relays de DM), `["app", <versão>]`,
  um `["recurso", <nome>]` por tipo de mensagem que o app lê (RNF-93: `texto`, `audio`, `foto`, `reacao`, `confirmacao`,
  `grupo`, `cartao`) e `alt`.
- Foto: como no kind `15`, o endereço no conteúdo e as tags do arquivo (`file-type`, `decryption-key`, `x`, `ox`, `dim`,
  `thumb`…). É o quadrado do meio da foto escolhida, 512 px e até ~60 KB, cifrado no Blossom; a prévia (96 px) vai no
  próprio cartão e aparece antes de baixar, e continua aparecendo se o servidor apagar o arquivo. Sem foto, conteúdo vazio.
- O `created_at` é a versão do cartão: o mais novo vale. Muda quando o nome, a foto, os relays ou a versão do app mudam.
- **Quem recebe:** vai junto da minha primeira mensagem a cada pessoa (no 1:1 e nos grupos) e da apresentação num grupo;
  quando nome ou foto mudam, a todos com quem já falei: quem já recebeu um cartão, os contatos do 1:1 em que escrevi e
  os membros dos grupos em que estou. Quem só me mandou um pedido não aceito não recebe (T7). Uma versão nova só da
  versão do app vai junto da próxima mensagem, sem pressa.
- **Quem lê:** o nome do cartão vira o "nome escolhido" do contato e o nome do membro nos grupos; o nome que eu dei ao
  contato continua valendo (RF-14). Os relays passam a ser onde procuro a pessoa. De quem não é contato o cartão só fica
  guardado (não vira pedido). A foto aparece só para contato aceito e quem está num grupo comigo; de pedido, só depois
  de aceitar (T9). De bloqueado, descartado.
- A tag `nome` na primeira mensagem continua indo, para quem ainda usa uma versão sem o cartão.

## 4. Dados no aparelho (IndexedDB)

Esquema inicial (Dexie). `PK` = chave primária, `idx` = índice.

| Tabela | Campos principais | Índices |
|---|---|---|
| `identity` | chave pública, chave privada cifrada, sal e parâmetros do Argon2id, frase confirmada (sim/não) | — |
| `settings` | chave/valor (modo foco, confirmações, expiração de mídia, entrega em lotes…) | PK: chave |
| `contacts` | chave pública, nome local, nome escolhido pelo contato, foto, estado (`aceito`, `pedido`, `bloqueado`), relays de DM | PK: chave pública; idx: estado |
| `conversations` | id, tipo (`direta`, `grupo`), membros (com horário de entrada), administradores, criador, nome, última mensagem, não lidas, exceção de modo foco, último `seq` enviado | PK: id; idx: última mensagem |
| `messages` | id do rumor, conversa, remetente, kind, texto, horário real, `seq`, status, resposta a, editada em, apagada, retida (modo foco), hash da mídia (`ox`) | PK: id; idx: [conversa + horário], status, retida |
| `reactions` | mensagem, autor, emoji | idx: mensagem |
| `profiles` | cartão de perfil mais recente de cada pessoa (o meu também): nome, foto, relays, versão do app, recursos, horário (versão 7 do Dexie) | PK: chave pública |
| `media` | `ox` (hash original), tipo, tamanho, arquivo (Blob), URLs Blossom, chave, nonce, `x`, guardar (sim/não), último acesso | PK: `ox`; idx: último acesso |
| `outbox` | eventos prontos, relays de destino, tentativas, próxima tentativa | idx: próxima tentativa |
| `sync` | relay, cursor | PK: relay |
| `seen_wraps` | id do gift wrap, recebido em | PK: id; idx: recebido em (limpeza após 9 dias) |
| `relays` | URL, papel (`dm`, `geral`, `blossom`), origem (`padrão`, `usuário`) | PK: URL |

**Expiração de mídia (RF-72):** tarefa local apaga de `media` os Blobs com último acesso há mais de 30 dias e `guardar = não`. A mensagem e a prévia continuam.

**Sem texto de interface no banco ([ADR-0008](adr/0008-internacionalizacao.md), versão 5 do Dexie, 2026-10-27):** a última mensagem de cada conversa fica como tipo (`texto`, `audio`, `arquivo`, `apagada`, `aviso`), o texto escrito pela pessoa (só no tipo `texto`) e, num aviso de grupo, o autor e o aviso estruturado (ação, alvos, nome do grupo). As mensagens de aviso guardam só o aviso, sem frase. A tela monta "Áudio" e "Ana adicionou João" na língua da pessoa e com os nomes atuais. A migração para a versão 5 refaz o resumo de cada conversa a partir da última mensagem; os avisos antigos guardam a frase em português em `texto`, que a tela ignora.

**Migrações:** cada mudança de esquema ganha uma nova versão no Dexie, com função de migração testada.

## 5. Compatibilidade com outros apps Nostr

| Recurso | Outro app Nostr vê |
|---|---|
| Texto, resposta, foto, áudio, reação | Normal (padrões NIP-17/25) |
| Grupo (tag `g`) | Conversa comum entre os mesmos participantes |
| Edição, confirmações, controle de grupo, pedido de reenvio | Ignorados, ou o texto da tag `alt` |
| Numeração (`seq`) | Ignorada |

## Questões em aberto

| # | Questão | Responsável |
|---|---|---|
| Q-P1 | Escolher os números dos kinds próprios (edição, confirmação, pedido de reenvio) no registro de NIPs (✅ controle de grupo = `4440`, confirmação = `4441`, cartão de perfil = `4442`, edição = `4443`, pedido de reenvio = `4444`, faixa 4440–4449 reservada, 2026-10-22); avaliar propor um NIP para confirmações de entrega, que hoje não têm padrão | Implementação |
| Q-P2 | Formato da figurinha sonora (v1): provavelmente kind `15` com imagem + áudio Opus curto, e `alt` "figurinha sonora" para outros apps (Q-F5) | Pedro (v1) |
| Q-P3 | Janela de espera antes de pedir reenvio por buraco na numeração | ✅ 30 segundos, até 3 pedidos com um dia entre eles (2026-10-29, seção 3.5) |
| Q-P4 | ✅ Português. Interoperabilidade da identidade via exportação da chave privada | — |
| Q-P5 | ✅ **Cartão de perfil privado** (decidido em 2026-10-29): um evento próprio, cifrado e embrulhado como uma mensagem, no lugar da tag `nome`. Leva nome, foto de perfil (RF-02, cifrada no Blossom), versão e recursos do app (RNF-93) e relays de DM; o aviso de chave nova fica no RF-16 (futuro). Vai junto da minha primeira mensagem a cada pessoa e, quando algo muda, a todos com quem já falei, no 1:1 ou em grupo; quem só me mandou um pedido não aceito não recebe (T7). O nome que eu dei ao contato vence o do cartão, que aparece nos detalhes do contato; a foto do cartão aparece sempre. Rejeitadas: só nome e foto, ou sem os relays (o cartão já é o lugar deles e evita outro formato depois); só no 1:1 (membros de grupo ficariam sem foto); o nome do cartão sobrescrever o local (o contato trocaria o nome que eu escolhi) | — |
