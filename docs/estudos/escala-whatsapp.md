# Estudo — Escala do WhatsApp × Lero-lero

- **Data do levantamento:** 2026-10-28
- **Objetivo:** imaginar a carga que o WhatsApp sustenta (usuários, mensagens, áudios, arquivos, chamadas), medir o
  Lero-lero contra ela em degraus de tamanho e achar gargalos, problemas e soluções para alimentar o
  [roadmap](../07-roadmap.md).
- **Método:** números públicos do WhatsApp (com a confiança de cada um), uma conta de ordem de grandeza com premissas
  explícitas (script no fim) e leitura da [arquitetura](../05-arquitetura.md), dos [RNF](../04-requisitos-nao-funcionais.md)
  e da pesquisa de relays ([prototipos/relays](../../prototipos/relays/README.md)). **Nada foi medido no Lero-lero
  sob carga**: as contas são estimativas para priorizar, não previsões.

## Resumo

1. **O WhatsApp não é a régua certa.** O Lero-lero não opera servidor: a carga não cai num datacenter, cai em
   **relays e servidores de mídia de voluntários**. A pergunta útil não é "o código aguenta?" (o cliente aguenta), mas
   **"quem paga e opera a infraestrutura em cada degrau?"**.
2. **Mensagens de texto não são o problema.** Até ~1 milhão de usuários a carga de texto é pequena (~400 mensagens/s
   na média); uma dezena de relays bem operados dá conta. O que quebra primeiro é **gente, dinheiro e política dos
   operadores**, não CPU.
3. **Os primeiros muros, em ordem:** (a) hoje só 7 de 100 relays de DM são aptos e nenhum fica no Brasil; (b) servidores
   Blossom gratuitos recusam mídia cifrada ou apagam arquivos; (c) o PWA sem push não avisa ninguém; (d) a hospedagem
   gratuita do próprio PWA tem limite de banda; (e) a sincronização com margem de 2 dias gasta mais dados que a meta
   RNF-20.
4. **Chamadas são o item que mais foge de "custo zero"**: TURN consome banda de verdade (≈1 Gbps médio para 15 milhões
   de usuários, no cenário baixo).
5. **Grupos grandes e multi-dispositivo** são limites de desenho (20 membros, um aparelho), não de volume.
6. Conclusão: **o desenho escala bem em volume de mensagens, mal em dependência de voluntários**. O caminho
   realista é crescer por degraus, financiando só o que não pode ser voluntário (ver "Soluções" e "Sugestões para o
   roadmap").

## 1. A régua: o que o WhatsApp sustenta

| Medida | Valor | Confiança |
|---|---|---|
| Usuários ativos por mês | > 3 bilhões | Alta: Meta, resultados do 1º tri de 2025 |
| Usuários ativos por dia | ~2,3 bilhões | Média: agregadores (≈77% dos mensais) |
| Mensagens por dia | > 100 bilhões (≈ 1,2 milhão/s na média) | Alta para o piso: WhatsApp, dez/2025; estimativas de 140–150 bi não são oficiais |
| Mensagens de voz por dia | ~7 bilhões | Média: repetido pela imprensa, sem fonte primária |
| Chamadas por dia | **2 bilhões** (WhatsApp, dez/2025) | **Baixa:** conflita com os 5,5 bi de voz + 2,4 bi de vídeo **por mês** (≈ 260 milhões/dia) de 2025. Usei o cenário baixo |
| Escala dos servidores (2014) | ~2 milhões de conexões por servidor, Erlang/FreeBSD, equipe de dezenas de engenheiros | Média: palestras de Rick Reed (Erlang Factory); resumos de terceiros divergem |
| Brasil | ordem de 150 milhões de usuários | Baixa: não verificado aqui; só serve de degrau |

Derivados que usei: ~43 mensagens enviadas por usuário ativo por dia (100 bi ÷ 2,3 bi), ~3 mensagens de voz por usuário
ativo por dia, pico de 3× a média (a virada do ano é muito pior).

**O que o WhatsApp tem e o Lero-lero não:** uma empresa que paga datacenters, um protocolo de conexão única por
aparelho, push nativo (FCM/APNs), descoberta de contatos pela agenda, servidores de chamada (relay e SFU) e equipes de
abuso. O Lero-lero troca tudo isso por "ninguém é dono", e o preço aparece abaixo.

## 2. Como a carga se distribui no Lero-lero

| Carga | WhatsApp | Lero-lero |
|---|---|---|
| Entrega de mensagem | 1 servidor da empresa, 1 cópia até entregar | Embrulho NIP-59 publicado em **1–3 relays do destinatário + cópia própria**: ~4 gravações por mensagem, retidas 7 dias |
| Conexões | 1 por aparelho | **1 por relay** (3 ou mais por aparelho aberto): as conexões somam ×3 na rede |
| Mídia | Servidores próprios, apagada após entrega | Blossom de terceiros, cifrada, deduplicada pelo hash |
| Notificação | FCM/APNs | Nenhuma no PWA; UnifiedPush no Android (v1) |
| Chamadas | Servidores próprios | WebRTC direto; TURN de terceiros (não existe ainda) |
| Grupos | Servidor distribui (até 1.024 + comunidades) | **O remetente cifra uma vez por membro** (até 20) |
| Abuso e spam | Sistemas e equipe da empresa | Prova de trabalho, pedidos de mensagem, políticas de cada relay |

## 3. Degraus de escala (estimativa)

Premissas: 77% dos usuários ativos por dia; 43 mensagens/dia; 4 eventos gravados por mensagem (3 relays do destinatário
+ cópia própria); mídia por usuário ativo por dia = 3 áudios de ~25 s (≈ 88 KB cada, RNF-22) + 2 fotos de 200 KB (RNF-23,
número de fotos **suposto**); 1,5 download por arquivo; 15% dos ativos conectados ao mesmo tempo, em 3 relays; chamadas:
0,11 por usuário ativo por dia (cenário baixo), 25% precisam de TURN, 70% voz de 5 min a 100 kbps e 30% vídeo de 5 min a 2 Mbps (somando
os dois sentidos).

| Usuários (mensais) | Mensagens/s (média / pico) | Gravações em relays/s (média / pico) | Mídia nova/dia | Mídia retida 7 dias | Conexões WebSocket (×3 relays) | TURN médio |
|---|---|---|---|---|---|---|
| 20 (beta) | ~0 | ~0 | ~0 | ~0 | dezenas | 0 |
| 10 mil | 4 / 12 | 16 / 47 | 10 GB | 70 GB | 3 mil | ~0 |
| 100 mil | 39 / 116 | 155 / 465 | 50 GB | 0,4 TB | 35 mil | 0,01 Gbps |
| 1 milhão | 388 / 1,2 mil | 1,6 mil / 4,7 mil | 0,5 TB | 3,6 TB | 350 mil | 0,05 Gbps |
| **15 milhões (10% do Brasil)** | 5,8 mil / 17 mil | 23 mil / 70 mil | 7,7 TB | 54 TB | **5,2 milhões** | **0,8 Gbps** |
| 150 milhões (Brasil todo) | 58 mil / 174 mil | 233 mil / 698 mil | 77 TB | 537 TB | 52 milhões | 8 Gbps |
| 3 bilhões (mundo) | 1,16 milhão / 3,5 milhões | 4,7 milhões / 14 milhões | 1,5 PB | 10,7 PB | ~1 bilhão | 163 Gbps |

Leitura:

- **Até 100 mil**: tecnicamente trivial. Um único `strfry` em máquina modesta aguentaria o texto; o limite é a
  política dos relays e os limites gratuitos (seções 4.1, 4.2, 4.4).
- **1 milhão**: ainda é carga de **poucas máquinas** (milhares de gravações/s). Exige uns 5–10 relays aptos, de
  operadores diferentes, e ~4 TB de mídia retida: **dezenas a poucas centenas de dólares por mês** de armazenamento,
  mais egress. Já não cabe em generosidade informal.
- **15 milhões**: 70 mil gravações/s no pico, 5 milhões de WebSockets e ~12 TB/dia de download de mídia: **dezenas de
  milhares de dólares por mês** só de mídia e TURN, repartidos entre operadores. Só funciona com rede de operadores
  organizada, doações ou algum modelo de sustentação.
- **Brasil todo ou mundo**: o texto continua viável **se espalhado por centenas de relays** (o WhatsApp faz 1,2 milhão
  de mensagens/s com uma frota enorme), mas aqui a frota teria que surgir de voluntários e dinheiro de terceiros.
  O desenho não impede; a organização não existe.

## 4. Gargalos e soluções

Ordem aproximada de quando cada um aparece. "Onde" aponta o documento ou item de roadmap relacionado.

### 4.1 Operadores de relay: poucos, concentrados e fora do Brasil (aparece em ~1 mil usuários)

- **Fato (2026-10-22):** de 100 relays de DM, só 7 protegem os embrulhos de quem não é o destinatário; um deles
  (`auth.nostr1.com`) tem 1.289 dos 9.420 usuários com relays de DM. Nenhum fica no Brasil. A lista padrão tem 3 relays
  de DM, a retenção de 7 dias ainda não foi confirmada.
- **Problema:** a promessa de "rede mantida por vários operadores brasileiros" (Visão) não existe; hoje a rede é a
  generosidade de 3 estrangeiros. Se um sair, 1/3 dos usuários perde o canal. Relays gratuitos também cortam sem aviso
  (limites de taxa, bloqueio de IP, fim da retenção).
- **Soluções:** (1) **operar um relay próprio de referência** (strfry com NIP-42, retenção de 7 dias) no Oracle
  Cloud Free ou numa VPS de ~R$ 30/mês, mesmo ferindo "custo zero" (RNF-84); é a medida que mais reduz risco por
  menos dinheiro; (2) publicar um **kit de relay** (imagem Docker + guia) e o programa de operadores já previsto no
  roadmap; (3) monitorar os relays da lista (job na CI que mede disponibilidade e retenção e atualiza `relays.json`);
  (4) **limites por usuário** e roteamento por chave: cada pessoa usa 3 relays escolhidos por sorteio da lista, para a
  carga se distribuir (hoje todos usam os mesmos 3).

### 4.2 Mídia: Blossom gratuito não foi feito para isso (aparece em ~10 mil a 100 mil)

- **Fato:** dos 27 Blossom testados, 10 são aptos; os 5 mais usados recusam binário opaco (mídia cifrada).
  A lista padrão tem 2 servidores. Em 100 mil usuários são ~50 GB/dia; em 1 milhão, 0,5 TB/dia.
- **Problema:** servidores gratuitos têm cota, apagam arquivos antigos ou bloqueiam. Mídia perdida = conversa
  quebrada para quem abre depois. WhatsApp apaga após a entrega, mas guarda no aparelho; aqui, se o arquivo some
  antes de o destinatário baixar, **ele nunca recebe**.
- **Soluções:** (1) **expiração curta e explícita** (7 dias como as mensagens) e aviso "arquivo expirado" claro;
  (2) subir para **2 ou 3 servidores** ao mesmo tempo (espelho) e tentar os demais na leitura; (3) um Blossom próprio
  em armazenamento barato (Cloudflare R2 tem egress gratuito, Backblaze B2 é barato; ~US$ 5–15/TB/mês de
  armazenamento, **preços a confirmar**) pago por doação; (4) **vídeo e arquivos grandes**: limite de tamanho (o
  WhatsApp limita a 2 GB, vídeos ~16 MB no celular antes de comprimir) e compressão no cliente; (5) a deduplicação
  por hash (RF-70) já corta o custo do reencaminhamento; manter.

### 4.3 Sincronização e dados (aparece desde o beta, pesa em milhares de usuários)

- **Problema:** o motor busca "desde o cursor − 2 dias". Com ~43 mensagens recebidas por dia, cada abertura baixa
  ~86 embrulhos de ~2 KB ≈ **170 KB**, mais a decifragem dupla (selo + presente) de todos num aparelho de 2 GB. A
  meta RNF-20 é **< 50 KB**. Em 1 milhão de usuários abrindo o app 10 vezes por dia isso são ~1,7 TB/dia de
  tráfego **repetido** nos relays. **A conferir no código:** o `seen` evita decifrar de novo, mas o download se
  repete? Medir é o primeiro passo.
- **Soluções:** (1) filtrar por `since` mais apertado e cobrir o embaralhamento do NIP-17 só com os IDs já vistos
  (buscar IDs primeiro, corpos depois); (2) **NIP-77 (Negentropy)**, que o `strfry` já suporta, troca só a diferença
  entre os conjuntos; (3) fazer os relays de DM do app serem escolhidos por suporte a Negentropy; (4) medir o custo
  real antes (Q-N4) e transformar RNF-20 em teste na CI.
- **Outros limites do aparelho:** cota do IndexedDB (navegadores podem apagar dados de PWA sem uso, sobretudo no
  iOS), memória (150 MB), histórico longo. Já há paginação e exclusão, mas faltam **busca**, **exportação** e **limpeza
  automática de mídia**.

### 4.4 Entrega sem push e a hospedagem do PWA (aparece em ~100 mil)

- **Notificação:** sem push, o PWA só recebe com o app aberto (RNF-25). Isso é uma decisão de privacidade e custo, mas
  **é a diferença mais sentida pelo usuário** em relação ao WhatsApp. Web Push exige um servidor que consulte os
  relays e dispare o aviso (um "pinger"); em escala são ~230 mil eventos/s de entrada só para 150 milhões de usuários,
  e o operador vê quem recebe mensagem (chave ↔ endpoint). No Android nativo (v1), UnifiedPush depende de
  distribuidores voluntários (ntfy).
  **Soluções:** um pinger **sem conteúdo** (só "há algo novo"), com código aberto e implantável por qualquer um, em
  Cloudflare Workers (cota gratuita limitada); no iOS, depende de instalar o PWA na tela inicial; ADR-0005 precisa de
  um aditivo sobre o custo em escala.
- **Hospedagem do PWA:** o GitHub Pages tem um limite flexível de banda (~100 GB/mês, **a confirmar** na documentação
  atual). Com 500 KB de código (RNF-16), são ~200 mil downloads completos por mês; atualizações do app e o
  `relays.json` consultado a cada abertura aproximam do limite com poucas centenas de milhares de usuários.
  **Soluções:** Cloudflare Pages (banda gratuita sem teto declarado, já citado em RNF-80); cache agressivo pelo
  service worker; `relays.json` com cabeçalho de cache e consulta no máximo 1× por dia.

### 4.5 Abuso, spam e moderação (aparece com o primeiro usuário desconhecido)

- **Problema:** qualquer um pode publicar um embrulho para qualquer chave. O WhatsApp tem equipes e sistemas contra
  spam, golpe e conteúdo ilegal; aqui existe a prova de trabalho (RF-90, ainda **não feita**), os pedidos de mensagem
  e o bloqueio. O relay não vê o conteúdo e **não pode filtrar**; cada relay aplica taxa por IP/chave.
  Moderação de grupos e denúncia de conteúdo ilegal (CSAM, golpes) sem poder ver o conteúdo é problema aberto de toda
  mensageria E2E, e um operador brasileiro responde ao Marco Civil (Q-N3).
- **Soluções:** concluir RF-90 (PoW adaptativa, que sobe em ataque); **reputação local** (só mostrar de não
  contatos depois de aceitar, já feito); denúncia que envia a mensagem decifrada ao projeto **por escolha da pessoa**
  (como o WhatsApp faz); orientação jurídica antes do lançamento (Q-N3).

### 4.6 Privacidade em escala (metadados)

- Mesmo cifrado, o relay vê **quem recebe, quando e de qual IP**. Em escala, relays grandes viram pontos de
  correlação (hoje 46 dos 100 maiores entregam os embrulhos a qualquer um). A lista padrão só com relays NIP-42 já
  mitiga; a longo prazo, **relays diferentes por conversa** e rede de transporte (Tor/VPN, RNF-47) reduzem a correlação.

### 4.7 Chamadas de voz e vídeo (fora do escopo hoje; custo alto)

- Já avaliado em [roadmap](../07-roadmap.md): WebRTC direto, sinalização por NIP-17 efêmero.
- **Carga no cenário baixo (0,11 chamada/usuário/dia):** 25% precisam de TURN (CGNAT, redes móveis, valor do roadmap).
  Para 1 milhão de usuários são ~0,6 TB/dia (≈ 0,05 Gbps médio, ~0,2 Gbps no pico); para 15 milhões, ~9 TB/dia (≈ 0,8 Gbps médio, ~3 Gbps no pico, ~US$ 15 mil/mês a
  US$ 0,05/GB). No cenário alto (0,9 chamada/dia), multiplique por 8.
- **Soluções:** (1) áudio 1:1 antes de vídeo; (2) TURN próprio com `coturn` em VPS com banda inclusa (muitas VPS
  incluem vários TB/mês) ou TURN gerenciado com cota gratuita, pagos por doação ou plano opcional; (3) STUN público
  para os 75% restantes; (4) limitar vídeo a qualidade baixa quando relayed; (5) chamada em grupo só com SFU (LiveKit
  ou mediasoup) no fim, ou nunca no MVP.
- **Toque de chamada:** sem push o PWA fechado não toca; é o maior impeditivo de produto, mais do que a banda.

### 4.8 Grupos, canais e multi-dispositivo (limites de desenho)

- **Grupos:** o remetente cifra e publica **um embrulho por membro por relay**: grupo de 20 → 19 embrulhos ×
  relays do destino ≈ 40–60 KB de envio por mensagem de texto. Aceitável para 20; **inviável para centenas** (WhatsApp:
  1.024 membros e comunidades; o Brasil vive em grupos grandes de condomínio, escola, igreja e trabalho). A carga
  de gravação nos relays cresce linearmente com o tamanho do grupo.
  **Soluções:** Marmot/MLS (ADR-0001 já prevê a troca) para cifrar uma vez por grupo e dar sigilo futuro;
  **canais** de difusão (um emissor, muitos leitores) com chave de grupo compartilhada para o caso de 1.000+.
- **Multi-dispositivo:** hoje um aparelho por conta. O WhatsApp oferece até 4 linkados. Nostr permite (mesma chave em
  vários aparelhos, o NIP-17 entrega ao mesmo relay), mas exige sincronizar lido/arquivado/rascunho e tratar a chave.
  Importa para "uso no dia a dia no computador".
- **Descoberta de contatos:** sem número de telefone não há "quem da minha agenda já usa". Convites por link/QR
  crescem devagar. É limite de **crescimento**, não de carga: o gargalo de escala real é de adoção.

### 4.9 Observabilidade e operação (aparece em ~10 mil)

- **Problema:** RNF-50 proíbe telemetria. Sem ela, ninguém sabe que o tempo de entrega dobrou ou que um relay
  perdeu mensagens, só quando as pessoas reclamam. WhatsApp mede tudo.
- **Soluções:** Q-N6 (resumo diário opt-in, só contagens, enviado pela própria rede); **sondas sintéticas na CI**
  (enviam mensagens entre contas de teste pelos relays reais e medem entrega, retenção e latência a cada hora; custo
  zero e sem privacidade em jogo). É a medida mais barata com maior ganho.

### 4.10 O que o cliente aguenta

Não é gargalo, mas vale registrar: cifrar uma mensagem de grupo de 20 membros (20 × selo + presente + assinatura)
precisa caber no aparelho de referência (RNF-14/18); o Web Worker já isola isso. Medir 100 mensagens seguidas no
aparelho de referência vira teste de desempenho (Q-N4).

## 5. Pontos fortes do desenho (o que já ajuda a escalar)

- **Sem servidor central:** não há banco único para saturar; a carga se reparte por relay.
- **Cliente faz o trabalho pesado** (cifra, deduplica, ordena): custo marginal para o projeto é zero.
- **Mídia deduplicada e baixada sob demanda** (RF-70/71): menos egress que o WhatsApp para reencaminhamentos.
- **Offline-first e fila de envio**: tolera relay fora do ar (RNF-35).
- **Nenhum dado nos servidores do projeto**: quase sem passivo de LGPD; abuso e retenção são problema dos relays.
- **Abstração do esquema de mensagens (T12/ADR-0001):** permite migrar para MLS sem reescrever o app.

## 6. Sugestões para o roadmap

Cada item está pensado como uma etapa pequena. Prioridade: **P1** antes de abrir ao público; **P2** antes de
~100 mil usuários; **P3** depois.

| # | Item | Por quê | Prio |
|---|---|---|---|
| 1 | **Sondas sintéticas na CI** (entrega, latência e retenção a cada hora nos relays e Blossom da lista) | Mede o que o projeto não pode medir pelos usuários (RNF-50); fecha Q-R1 | P1 |
| 2 | **Relay e Blossom de referência próprios** (VPS barata ou nível gratuito), documentados como "kit do operador" | Remove o ponto único de falha; começa o programa de operadores | P1 |
| 3 | **Medir o custo de sincronização** (KB por abertura com 0, 50 e 500 mensagens) e teste de CI para RNF-20 | Hipótese de 170 KB vs meta de 50 KB | P1 |
| 4 | **Mídia: espelho em 2 servidores + expiração visível** | Arquivo perdido quebra a conversa | P1 |
| 5 | **Sorteio de relays por usuário** a partir da lista (em vez de todos nos mesmos 3) | Distribui carga e reduz correlação | P2 |
| 6 | **Negentropy (NIP-77)** para sincronizar | Corta tráfego repetido ao abrir | P2 |
| 7 | **Migrar o PWA para Cloudflare Pages** (ou garantir cache) | Limite de banda do GitHub Pages | P2 |
| 8 | **Pinger de push sem conteúdo** (Web Push) + aditivo no ADR-0005 | Maior diferença percebida frente ao WhatsApp; condição para chamadas | P2 |
| 9 | **Prova de trabalho (RF-90)** | Spam em relays e pedidos | P2 |
| 10 | **Limites de mídia** (tamanho, vídeo comprimido, cota local e limpeza automática) | Egress e cota do IndexedDB | P2 |
| 11 | **Chamadas de áudio 1:1** com STUN público + TURN próprio opcional | Maior custo do futuro; começar pequeno | P3 |
| 12 | **MLS/Marmot e canais** | Grupos acima de 20 e sigilo futuro | P3 |
| 13 | **Multi-dispositivo** | Computador do dia a dia | P3 |
| 14 | **Modelo de sustentação** (doações, plano opcional, apoio institucional) | Acima de 1 milhão de usuários "custo zero" deixa de ser verdade | P3 |

Também vale registrar como **questões em aberto** (registradas em 2026-10-28 no [04](../04-requisitos-nao-funcionais.md), que guarda a numeração):

- **Q-N7:** aceitar uma exceção a "custo zero" (RNF-84) para um relay de referência de ~R$ 30/mês? (Recomendação: sim, a
  partir do beta.)
- **Q-N8:** qual é o teto de usuários com que o projeto se compromete na v1 (ex.: 100 mil) antes de exigir um modelo de
  sustentação?
- **Q-N9:** quem opera o TURN, se as chamadas entrarem?

## 7. Infraestrutura própria: que servidores manter

Pergunta do Pedro em 2026-10-28: se ele estivesse disposto a manter servidores próprios para garantir a escala,
quais seriam? **Só para pensar; nada decidido** (a decisão de custo está na Q-N7 do
[04](../04-requisitos-nao-funcionais.md)). Os números repetem os da seção 3.

### 7.1 Os oito tipos de servidor

| # | Servidor | Para quê | Estado |
|---|---|---|---|
| 1 | **Relay Nostr** (`strfry`, NIP-42, retenção de 7 dias) | Texto, avisos de grupo, confirmações de entrega e a sinalização das chamadas | Guarda dados, disco NVMe |
| 2 | **Blossom + armazenamento de objetos** (S3-compatível, atrás de CDN) | Áudio, foto, vídeo e arquivos, sempre cifrados | Guarda dados; maior consumo de banda de saída |
| 3 | **TURN/STUN** (`coturn`) | Chamadas quando a conexão direta falha (~25%) | Sem disco, muita banda |
| 4 | **SFU** (LiveKit ou mediasoup) | Chamada e vídeo em grupo | Sem disco, CPU e banda |
| 5 | **Gateway de push** (Web Push + UnifiedPush) | Avisar o aparelho de que há mensagem nova, sem conteúdo; é o que faz o PWA fechado tocar e o toque de chamada funcionar | Guarda só chave e endpoint |
| 6 | **Hospedagem estática com CDN** | PWA, atualizações e `relays.json` | Sem estado |
| 7 | **Observabilidade e sondas** (métricas, logs, página de status) | Medir entrega, latência e retenção sem telemetria dos usuários | Só métricas |
| 8 | **Borda e proteção** (proxy reverso, balanceador, anti-DDoS, DNS, certificados) | Proteger os demais | Sem estado |

Opcionais: **relay de backup** com retenção longa (backup da conta, RF-06) e **receptor de denúncias** voluntárias
(seção 4.5).

**O que não é preciso montar:** servidor de contas ou sessão (a identidade é a chave), banco central de mensagens
(cada relay guarda a sua fatia), diretório de telefones (o app não usa telefone) e transcodificação de vídeo (com
cifra ponta a ponta o servidor só vê bytes opacos; comprimir é no aparelho, uma restrição de desenho).

### 7.2 Quanto de cada

| | 100 mil usuários | 1 milhão | 15 milhões |
|---|---|---|---|
| Relays | 2 (1 reserva) | 4–6 máquinas de 8 vCPU/32 GB; ~2 TB de eventos retidos | ~50–80 máquinas; ~28 TB retidos; 5 milhões de conexões |
| Mídia | ~0,4 TB retido | ~4 TB retido; 0,8 TB/dia de saída | ~54 TB retido; 11,5 TB/dia de saída (≈ 1 Gbps médio, ~3,5 no pico) |
| TURN | 1–2 (redundância) | 2–3; ~0,05 Gbps médio | 4–6 com portas de 10 Gbps; ~0,8 Gbps médio, ~3 no pico; várias regiões do Brasil |
| Push | 1 | 2 | alguns nós, junto dos relays |
| SFU | só com chamada em grupo | idem | por participantes simultâneos |
| Estático, observabilidade, borda | 1 de cada, pequenos | idem | idem, com redundância |

Contas dos relays: 4 gravações × 2 KB por mensagem (1 milhão: ~270 GB/dia, 7 dias ≈ 1,9 TB; 15 milhões: ~4 TB/dia,
≈ 28 TB); conexões a ~70–100 mil por máquina, valor **conservador e a medir**. No cenário alto de chamadas
(0,9 por usuário por dia), o TURN multiplica por ~8 (≈ 6 Gbps médio em 15 milhões).

### 7.3 O que decide o custo e a operação

- **Banda de saída decide o custo, não CPU.** Mídia e TURN dominam. Nuvem que cobra egress por GB (como a AWS em São
  Paulo) fica proibitiva em escala: preferir provedor com tráfego incluso ou armazenamento sem taxa de saída
  (Cloudflare R2, Backblaze B2). **Preços a confirmar.**
- **O relay particiona sozinho:** cada pessoa publica em quais relays recebe (kind 10050), então basta somar nós e
  distribuir os usuários; não há fragmentação de banco.
- **Mídia e relays em regiões e armazenamentos diferentes:** mídia em armazenamento barato, relays em disco rápido
  perto do usuário.
- **A operação é o gargalo real** com ~5 h por semana: contêineres, infraestrutura como código (um repositório que
  recria tudo) e serviços gerenciados onde houver; evitar servidor que só uma pessoa sabe consertar.

### 7.4 Ordem sugerida

1. **Até o beta e ~100 mil usuários:** 2 relays (1) + armazenamento de objetos com Blossom (2) + sondas (7). Estático
   e borda ficam gratuitos (Cloudflare Pages).
2. **Ao decidir fazer chamadas:** TURN (3) e gateway de push (5), que também libera o toque. Push vem antes porque,
   sem ele, a chamada não toca.
3. **Só no fim:** SFU (4), se houver chamada em grupo.

### 7.5 Isso mantém a descentralização?

Sim, **se os servidores próprios forem entradas comuns** em `relays.json` e no kind 10050, sem tratamento especial
no protocolo, em mais de um provedor e mais de uma região. Assim o Pedro não vira "a empresa dona da rede" que a
[Visão](../01-visao.md) quer evitar, e terceiros continuam podendo operar relays ao lado dos dele.

## 8. Limites deste estudo

- Os números do WhatsApp vêm de agregadores e resumos de palestras; só os marcados "alta" têm origem oficial. O ponto
  mais frágil é o de **chamadas por dia** (dois números incompatíveis).
- Premissas de uso (fotos por dia, duração de chamadas, 15% conectados, 4 gravações por mensagem) são **minhas
  suposições** e mudam o resultado por fatores de 2 a 8. A hipótese mais sensível é a do tamanho do embrulho (2 KB,
  limite do RNF-21; o real deve ser menor ou parecido).
- Capacidade de um relay `strfry` e custos de armazenamento/egress citados são ordens de grandeza sem medição;
  confirmar com um benchmark em `prototipos/` antes de decidir compra.
- Não considera iOS (que limita PWA e push), custo de moderação, nem o efeito de rede (usuário só entra se os amigos
  já estão).

## Apêndice — como os degraus foram calculados

```
ativos/dia      = mensais × 0,77
mensagens/dia   = ativos/dia × 43,5            (100 bi ÷ 2,3 bi)
gravações/s     = mensagens/s × 4              (3 relays do destinatário + cópia própria)
mídia/dia       = ativos/dia × (3 × 88 KB + 2 × 200 KB)
mídia retida    = mídia/dia × 7
download/dia    = mídia/dia × 1,5
conexões        = ativos/dia × 0,15 × 3 relays
TURN/dia        = ativos/dia × 0,11 chamadas × 25% via TURN × (70% × 7,5 MB + 30% × 75 MB)
pico            = 3 × média
```

Fontes dos números do WhatsApp: [timelines.ai](https://timelines.ai/whatsapp-stats),
[Infobip](https://www.infobip.com/blog/whatsapp-statistics-2025-global-usage-market-overview),
[iPhoneInCanada (dez/2025)](https://www.iphoneincanada.ca/2025/12/29/whatsapp-rolls-out-new-year-features-on-its-busiest-day/),
[High Scalability](https://highscalability.com/how-whatsapp-grew-to-nearly-500-million-users-11000-cores-an/),
[Erlang Factory 2014, Rick Reed](https://www.erlang-factory.com/sfbay2014/rick-reed).
