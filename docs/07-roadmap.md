# 07 — Roadmap

- **Status:** ✅ aprovado
- **Última atualização:** 2026-10-29

Aqui ficam o plano e o estado de cada item. Como cada coisa ficou pronta (escolhas, alternativas, bugs achados no
caminho) está no [histórico de entregas](historico.md).

## Onde estamos

- **Feito:** M0 (menos uma espera: o aparelho de 2 GB), M1, M2 e M3 inteiros; do M4,
  pedidos de mensagem e bloqueio, o backup cifrado e a prova de trabalho.
- **Próximo:** o primeiro item sem "✅" na [ordem](#ordem-do-restante-do-mvp) abaixo (hoje, o item 12).
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
| M0 Fundação | 3 sem | ✅ 2026-10-16 a 22; falta medir no aparelho de 2 GB (retenção dos relays confirmada em 2026-10-29) |
| M1 Conversas 1:1 | 8 sem | ✅ 2026-10-16 a 22 |
| M2 Mídia (e grupos, adiantados do M3) | 6 sem | ✅ 2026-10-22 a 27 |
| M3 Conversa do dia a dia | 6 sem | ✅ 2026-10-26 a 29 |
| M4 Segurança e confiança | 4 sem | Pedidos, bloqueio, backup, prova de trabalho e detecção de perdas feitos; itens 13 a 15 da ordem |
| M5 Polimento | 4 sem | A fazer: item 16 |
| Revisão de prontidão | — | A fazer, antes do beta |
| Beta fechado | 6 sem de uso | A fazer |
| v1 Android + desktop | 26 sem | Depois do beta |

O ritmo real ficou muito acima das estimativas: de 16 a 22/10 saíram o equivalente a ~15 semanas delas. A projeção
original (MVP público no 3º trimestre de 2027, v1 no 1º de 2028) precisa ser refeita (Q-M1).

## Ordem do restante do MVP

<!-- Item concluído termina com "✅ Feita em <data>": `scripts/situacao.sh` aponta o primeiro sem essa marca como o
próximo. Os números são citados em outros docs: não renumerar. -->

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
13. Guardar o código de recuperação em arquivo ou cartão (M4; D2 do [ADR-0009](adr/0009-protecao-e-recuperacao-da-conta.md), RF-09 a): compartilhar um arquivo autoexplicativo (explicação, link de restauração e as 12 palavras), imprimir o cartão, restaurar pelo arquivo ou pelo link, e a tela "Proteção da conta". Sem dependências; entra com e2e.
14. Frase no gerenciador de senhas (M4; D1, RF-09 b). **Começa por um protótipo que mede, no Motorola Edge 60 e num iPhone, se o navegador oferece "Salvar senha?" no PWA instalado**; o resultado decide se a camada entra.
15. Passkey (M4; C, RF-08): entrar com digital ou rosto e restaurar em aparelho novo, com o backup cifrado pela chave PRF nos relays. **Só depois da decisão do domínio (Q-N1).**
16. Polimento (M5), com a velocidade da suíte e2e, revisão de prontidão e beta.

## MVP (PWA) por marco

✅ feito · ⬜ a fazer · ➡️ mudou de marco

### M0 — Fundação

- ✅ Monorepo (`packages/core`, `packages/app`), TypeScript, Svelte, Vite, testes, CI, licença AGPL-3.0.
- ✅ PWA publicado no GitHub Pages.
- ✅ Lista padrão de relays e Blossom (Q-R1): retenção de 7 dias confirmada em 2026-10-29 para toda a lista, menos o
  Blossom cdn.hzrd149.com, trocado pelo blossom.jumble.social. Fica em aberto: relays no Brasil (Q-D2).
- ⬜ Protótipo de medição (Q-N4): pronto e rodado num celular intermediário; falta rodar no aparelho de referência
  (Android 2 GB), que decide o [ADR-0002](adr/0002-stack-do-cliente.md).

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
- ⬜ Arquivos além de fotos e "Salvar" no aparelho (RF-44, 45). **Ainda fora da ordem**; ver "Pedidos e ideias".

**Pronto quando:** um grupo de 5 pessoas conversa com respostas, reações e menções; os status aparecem corretamente;
dá para selecionar várias mensagens e agir de uma vez; os textos da interface estão fora do código, com português
como língua-base.

### M4 — Segurança e confiança

- ✅ Pedidos de mensagem e bloqueio, inclusive vindos de grupo, com Contatos em abas (RF-12, 13).
- ✅ Backup cifrado de perfil, contatos, grupos e ajustes (RF-06).
- ✅ Prova de trabalho (14 bits) e "Possível spam" em Pedidos (RF-90).
- ✅ Detecção de perdas: numeração, pedido de reenvio automático e prazo de 7 dias com "Reenviar" (RF-53).
- ⬜ Proteção da conta em camadas ([ADR-0009](adr/0009-protecao-e-recuperacao-da-conta.md)): arquivo ou cartão,
  gerenciador de senhas, passkey (RF-08, 09). Itens 13 a 15.
- ➡️ Modo foco (RF-52, 60..62) e entrega em lotes (RF-63): v1.

**Pronto quando:** o critério de aceite "Perda de identidade" passa; a prova de trabalho leva menos de 1 s no aparelho
de referência; uma mensagem apagada propositalmente de um relay de teste é detectada e reenviada.

### M5 — Polimento

- ⬜ Revisão de acessibilidade WCAG 2.2 AA com leitor de tela (RNF-60..63).
- ⬜ Revisão de textos para linguagem simples (RNF-64).
- ⬜ Medição de todas as metas de desempenho e dados no aparelho de referência (seções 2 e 3 do
  [04](04-requisitos-nao-funcionais.md)).
- ⬜ Velocidade da suíte e2e (medida em 2026-10-26: ~99 s na CI com 2 workers). Caminhos, do que mais rende: subir os
  workers da CI para 3 ou 4, repetindo a suíte antes de adotar (a carga já expôs corridas); encurtar o
  `envio-sem-rede` (35 s, o mais longo); dividir em dois jobs (`--shard`). Vale quando a suíte crescer.
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
| Monitoramento | Sondas sintéticas (contas de teste trocando mensagens pela rede real, a partir da CI), painel de saúde dos relays e servidores Blossom, diagnóstico local enviado pela própria pessoa (Enviar comentário); decidir a Q-N6 (dados técnicos de uso com consentimento) |
| Lançamento e volta atrás | Processo de publicação, como reverter uma versão ruim (service worker, cache), migrações do banco local sem perder dados, comunicação de incidentes a quem usa |

**Pronto quando:** cada tema tem os riscos listados com mitigação ou aceite documentado, e os itens críticos estão
resolvidos.

### Beta fechado (~6 semanas de uso)

- 10–20 pessoas, incluindo pelo menos algumas idosas ou com pouca familiaridade digital (RNF-65).
- Canal simples de feedback (ex.: um grupo no próprio app).
- Acompanhar: mensagens perdidas, dificuldades de cadastro, consumo de dados, travamentos.

**Pronto para o lançamento público quando:**
- nenhuma perda de mensagem sem detecção;
- todos os participantes conseguiram cadastrar, adicionar contatos e mandar áudio sem ajuda;
- orientação jurídica obtida (Q-N3);
- decisão sobre domínio próprio (Q-N1);
- guia publicado para voluntários rodarem relays e servidores Blossom (Q8 da Visão).

## Pedidos e ideias ainda fora da ordem

Registrados a pedido do Pedro; entram na ordem quando ele decidir.

- **Arquivos além de fotos e "Salvar" no aparelho** (RF-44, 45; 2026-10-27). PDF, documentos e outros tipos pelo mesmo
  caminho das fotos (cifra, Blossom, envio com repetição, hash único do RF-70, encaminhar sem reenviar), com balão de
  nome, tipo e tamanho e download sob demanda; "Salvar" no menu da mensagem para foto e arquivo. Decidir antes: limite
  de tamanho por arquivo, tipos bloqueados (executáveis; o app nunca abre o arquivo sozinho, T a registrar) e como
  salvar no Android e no iOS pelo PWA (Web Share com arquivos ou `<a download>`).
- **Baixar a foto sozinha** (2026-10-28). A prévia de 96 px esticada no balão ainda fica borrada; o que resolve de vez
  é baixar a foto sem toque, como o WhatsApp, mas isso gasta dados e mostra o IP a quem não é contato (T7). Proposta:
  só de contatos aceitos e talvez só no Wi-Fi.
- **Câmera na hora** para fotos (hoje só a galeria).
- **Ajustar o recorte da foto de perfil** (RF-02; 2026-10-29). Hoje o app usa o quadrado do meio da foto escolhida.
  Tela para arrastar e aproximar antes de salvar, como no WhatsApp.
- **Qualidade do som do áudio** (2026-10-22 e 26). Opus a 28 kbps com supressão de ruído e cancelamento de eco do
  navegador: sem cortes, mas ainda "um pouco feio" em lugar barulhento. Testar, comparando gravações no Motorola do
  Pedro: subir a taxa (36 a 48 kbps); desligar o cancelamento de eco; modo de voz do Opus; RNNoise em WebAssembly
  (~150 KB a mais no app); conferir se grava em 48 kHz mono. Decidir pela escuta, não por número.
- **Aviso de versão nova mais rápido** (2026-10-22). Hoje pode levar 10 minutos ou mais: o Pages guarda os arquivos em
  cache por até 10 minutos e o app só procura versão nova quando volta para a tela. Possível: procurar a cada poucos
  minutos com o app aberto. O cache só encurta com domínio próprio (Q-N1) e outro hospedeiro.
- **Favoritar ainda vale a pena?** (2026-10-29). As favoritas ficam só no aparelho e não entram no backup (RF-06,
  decidido em 2026-10-29), então somem na troca de celular. Rever se a função continua útil assim, se muda (ex.: só
  como atalho para achar a mensagem) ou se sai.
- **Backup completo e opcional na nuvem** (2026-10-29; para avaliar depois). Complementa o RF-06, que de propósito não
  leva mensagens, favoritas nem mídia: um arquivo cifrado com chave derivada da frase, guardado onde só a pessoa acessa.
  Proposta em duas etapas: (1) exportar e importar o arquivo em Ajustes, pelo menu de compartilhar (sem servidor nem
  login, funciona no PWA); (2) automático no Google Drive, que pede OAuth, domínio próprio (Q-N1) e revisão do Google,
  e combina mais com a v1 nativa (no iPhone, o iCloud não está aberto ao PWA). Decidir: mídia entra ou é opcional
  (tamanho), lembrete de salvar e como importar por cima de mensagens que já estão no aparelho.
- **Escolha da língua em Ajustes e manifesto do PWA traduzido**: quando houver a segunda língua.
- **Testes e2e que ficaram nos rascunhos** (`prototipos/e2e-rascunho`): extras da identidade e do PIN (bloquear,
  esqueci o PIN, limite de tentativas), o pedido de contato e a publicação por cima de um app antigo com o cache do
  Pages.

## Limites conhecidos

Aceitos por ora; cada um tem a origem no [histórico](historico.md).

- Fechar o app nos ~10 s em que o envio 1:1 busca os relays de alguém novo deixa a mensagem pendente sem entrada na
  fila. A mesma janela curta existe ao pôr avisos de grupo na fila.
- Falha de gravação no banco (cota cheia, erro do navegador) ainda perde a mensagem recebida, porque o embrulho é
  marcado como visto mesmo quando o processamento lança.
- `markDeleted` grava a conversa sem esperar a vez (`conversations/lock.ts`), por ser chamada de dentro de
  `storeIncoming`.
- A edição de uma mensagem não é reenviada: quem a recebe por um pedido de reenvio vê o texto original.
- Se um áudio tocava quando o envio dele terminou, o balão é recriado e a reprodução recomeça.

## v1 — Android e desktop nativos (~26 semanas)

| Item | Requisitos |
|---|---|
| App Android com Capacitor; APK direto assinado | RNF-02, 81 |
| Notificações com UnifiedPush; decidir quem dispara o "acorde" ([ADR-0005](adr/0005-notificacoes.md)) | RF-82 |
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
- iOS; Google Play (Q-N2); notarização no macOS (Q-N5).
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
| P3 | Modelo de sustentação (Q-N8) | — |

## Pontos de decisão

| Quando | Decisão |
|---|---|
| Fim do M0 | O desempenho medido no aparelho de referência confirma PWA + Svelte? Se não, rever o [ADR-0002](adr/0002-stack-do-cliente.md) |
| Fim do beta | Lançar publicamente ou fazer mais uma rodada de correções |
| Início da v1 | Quem dispara o push no Android; Capacitor ou Tauri 2 para Android |
| Out/2027 | Marmot está maduro o suficiente para forward secrecy? ([ADR-0001](adr/0001-protocolo-de-transporte.md)) |

## Questões em aberto

| # | Questão | Responsável |
|---|---|---|
| Q-M1 | Refazer as estimativas e a projeção de datas com base no ritmo real | Pedro |
| Q-U2 | Proteção da conta em camadas ([ADR-0009](adr/0009-protecao-e-recuperacao-da-conta.md)): o arquivo de recuperação fica em texto aberto (recomendado) ou cifrado com o PIN? E a D1 vale a pena se o aviso de salvar senha não aparecer no PWA instalado? | Pedro (ao implementar os itens 13 e 14) |

Resolvidas: Q-I1 (internacionalização, 2026-10-27, [ADR-0008](adr/0008-internacionalizacao.md)) e Q-U1 (cadastro sem a
frase, 2026-10-26); detalhes no [histórico](historico.md).
