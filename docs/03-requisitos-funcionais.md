# 03 — Requisitos funcionais

- **Status:** ✅ aprovado
- **Última atualização:** 2026-10-26

## Fases

| Fase | Plataforma | Objetivo |
|---|---|---|
| **MVP** | Web/PWA | Validar o núcleo: identidade, contatos, conversas 1:1 e em grupos pequenos, áudio, fotos, modo foco |
| **v1** | Android nativo (Capacitor) + desktop nativo (Tauri) | Notificações soberanas, figurinhas, modos de banda, proteção do app |
| **Futuro** | + iOS | Chamadas, grupos grandes, multi-dispositivo, forward secrecy, recuperação de conveniência (Pix e gov.br) |

**Prioridade dentro do MVP (MoSCoW):** **Must** = sem isso não há MVP · **Should** = importante, mas pode ser cortado se o prazo apertar · **Could** = só se sobrar tempo.

**Repriorização (decidida em 2026-10-22):** o critério para o resto do MVP passou a ser o uso no dia a dia (o que faz um grupo de amigos usar o app em vez do WhatsApp). Saíram do MVP e foram para a v1: modo foco e o estado "retida" (RF-52, 60–62), entrega em lotes (RF-63) e expiração de mídia com o painel de armazenamento (RF-72, 73). A detecção de perdas (RF-53) foi mantida no MVP.

## 1. Identidade e conta

| ID | Requisito | Prioridade | Fase |
|---|---|---|---|
| RF-01 | Criar identidade sem telefone nem e-mail: o app gera o par de chaves e o usuário escolhe um nome de exibição | Must | MVP |
| RF-02 | Foto de perfil opcional, no cartão de perfil privado (só para quem conversa comigo; de pedido de mensagem, só depois de aceitar) ([06](06-protocolo-e-dados.md) §3.10) | Could | MVP |
| RF-03 | Mostrar a **frase de recuperação** (12 palavras) com explicação simples e um **teste de verificação** (ex.: "digite a 3ª e a 7ª palavras"). **Não no cadastro, e sim ao ganhar o primeiro contato** (decidido em 2026-10-26, Q-U1 do [07](07-roadmap.md)): uma tela própria, uma vez, com "Guardar agora" e "Depois" | Must | MVP |
| RF-04 | Lembrete periódico para quem ainda não confirmou que guardou a frase: aviso na tela inicial, só depois de ter algum contato; "Depois" ou "Lembrar depois" o adiam por 3 dias (1 dia se o risco de perder os dados for maior, como no Safari do iPhone sem instalar) | Should | MVP |
| RF-05 | Restaurar a identidade num aparelho novo a partir da frase | Must | MVP |
| RF-06 | Backup cifrado de contatos, grupos, configurações e do próprio perfil (nome e foto) nos relays, restaurado junto com a identidade; achando o backup, a restauração não pede o nome de novo. **Não leva mensagens nem favoritas** (decidido em 2026-10-29: o texto ficaria nos relays sem prazo, ampliando a T11, além do limite de ~64 KB do NIP-44 e dos dados gastos a cada republicação; rejeitadas: favoritas com texto limitadas às 100 mais recentes e opção em Ajustes) | Should | MVP |
| RF-07 | Bloqueio do app com PIN ou biometria do aparelho (opcional) | — | v1 |
| RF-08 | **Passkey** (WebAuthn com PRF): entrar com digital ou rosto no lugar do PIN e restaurar num aparelho novo sem digitar a frase; o backup cifrado com a chave da passkey fica nos relays. Opt-in, nunca no lugar da frase; começa só depois da decisão do domínio (Q-N1); adiada em 2026-10-29 para depois do beta. [ADR-0009](adr/0009-protecao-e-recuperacao-da-conta.md). Pix e gov.br seguem adiados (Q-A7) | Should | Depois do beta e de Q-N1 |
| RF-09 | **Guardar o código de recuperação sem copiar à mão** ([ADR-0009](adr/0009-protecao-e-recuperacao-da-conta.md)): (a) botão que abre o menu de compartilhar com um arquivo autoexplicativo (o que é, aviso para não enviar a ninguém, como restaurar, link de restauração e as 12 palavras) e opção de imprimir um cartão; (b) a frase salva no gerenciador de senhas do navegador, por um formulário que ele reconhece. Tela única "Proteção da conta" com o estado; uma camada concluída basta para parar o lembrete do RF-04. Restaurar também a partir do arquivo, do link ou do preenchimento automático | Should | MVP |

## 2. Contatos

| ID | Requisito | Prioridade | Fase |
|---|---|---|---|
| RF-10 | Adicionar contato escaneando o **QR code** da outra pessoa | Must | MVP |
| RF-11 | Adicionar contato por **link de convite**, que pode ser enviado por qualquer meio (inclusive pelo WhatsApp) | Must | MVP |
| RF-12 | **Pedidos de mensagem:** mensagens de quem não é contato vão para uma caixa separada, sem notificação e sem carregar links ou mídia até o usuário aceitar; vale também para grupo em que me põe alguém que não é contato | Must | MVP |
| RF-13 | Bloquear contato (bloqueio local: mensagens daquela chave são descartadas) | Must | MVP |
| RF-14 | Renomear o contato localmente; o nome que o usuário deu prevalece sobre o nome que o contato escolheu (dificulta o golpe do falso parente) | Should | MVP |
| RF-15 | Encontrar contatos por **CPF ou chave Pix**, só entre usuários que optaram pela recuperação via Pix/gov.br (Q-F4) | — | Futuro |
| RF-16 | Verificação de contato por QR presencial e alerta de "contato com chave nova" (Q-A4) | — | Futuro |
| RF-17 | Denúncia a operadores de relays e listas de bloqueio compartilhadas | — | Futuro |

## 3. Conversas

| ID | Requisito | Prioridade | Fase |
|---|---|---|---|
| RF-20 | Enviar e receber mensagens de texto 1:1, inclusive com o destinatário offline | Must | MVP |
| RF-21 | Lista de conversas ordenada pela mais recente, com contador de não lidas | Must | MVP |
| RF-22 | Responder/citar uma mensagem específica | Should | MVP |
| RF-23 | Reagir com emoji | Should | MVP |
| RF-24 | Editar mensagem de texto enviada, até 15 minutos depois; quem recebe vê "editada", sem o texto antigo (decidido em 2026-10-29; rejeitados: 1 hora, sem prazo, e mostrar o histórico) | Should | MVP |
| RF-25 | Apagar mensagem para todos. Num sistema descentralizado isso é um **pedido**, não uma garantia: apps de terceiros podem ignorá-lo, e o app deve deixar isso claro | Should | MVP |
| RF-26 | Busca local nas conversas | Could | MVP |
| RF-27 | Mensagens temporárias (somem após 24 h, 7 dias etc.) | — | v1 |
| RF-28 | **Selecionar várias mensagens** e agir de uma vez: favoritar, excluir (para mim ou para todos, RF-25), copiar e encaminhar. Favoritar é local. Pedido do Pedro em 2026-10-26 | Should | M3 ✅ (2026-10-28) |
| RF-29 | **Botão de emojis** no campo de mensagem, para inserir emojis no texto sem depender do teclado do celular. Pedido do Pedro em 2026-10-30 | Should | M3 |

## 4. Grupos

| ID | Requisito | Prioridade | Fase |
|---|---|---|---|
| RF-30 | Grupos pequenos, de até **20 membros** ([ADR-0001](adr/0001-protocolo-de-transporte.md)) | Must | MVP |
| RF-31 | Criar grupo, dar nome, adicionar e remover membros, sair do grupo; o criador é administrador e pode promover outros. Só o criador remove ou rebaixa administradores; se ele sair, o título passa ao administrador mais antigo (ou ao membro mais antigo). Regras completas em [06 §3.3](06-protocolo-e-dados.md) | Must | MVP |
| RF-32 | Membro removido deixa de receber as mensagens novas | Must | MVP |
| RF-33 | Todos os recursos de conversa (seção 3) e de mídia (seção 5) funcionam em grupos | Must | MVP |
| RF-35 | **Mencionar** alguém no grupo digitando `@` e escolhendo a pessoa numa lista. A menção guarda a chave da pessoa, não o texto, e cada um vê o nome que conhece (o do contato, ou "~Nome"); quem foi mencionado vê a menção destacada. Pedido do Pedro em 2026-10-22 | Should | MVP |
| RF-34 | Grupos grandes (centenas de membros), com protocolo de grupo dedicado (ex.: MLS) | — | Futuro |

## 5. Mídia

| ID | Requisito | Prioridade | Fase |
|---|---|---|---|
| RF-40 | **Áudio:** gravar, enviar e ouvir mensagens de voz, com velocidade 1x / 1,5x / 2x; codec eficiente para voz (ex.: Opus em baixa taxa) | Must | MVP |
| RF-41 | **Imagens:** enviar fotos com compressão automática; o destinatário recebe primeiro uma prévia leve e baixa a imagem completa quando quiser (ou automaticamente, conforme configuração) | Must | MVP |
| RF-42 | Toda mídia é cifrada antes de sair do aparelho | Must | MVP |
| RF-43 | **Figurinhas**, incluindo a **figurinha sonora** (imagem + áudio curto) | — | v1 |
| RF-44 | **Arquivos** (PDF, documentos e outros tipos): enviar como anexo, cifrados e guardados uma vez, como as fotos (RF-41, 70); o balão mostra nome, tipo e tamanho, e o arquivo baixa sob demanda (RF-71). Vídeos ficam de fora por ora. Pedido do Pedro em 2026-10-27 | Should | M3 |
| RF-45 | **Salvar no aparelho** a foto e o arquivo recebidos (ou enviados), pelo menu da mensagem, para a galeria ou a pasta de downloads | Should | M3 |

## 6. Status de entrega

| ID | Requisito | Prioridade | Fase |
|---|---|---|---|
| RF-50 | Indicadores enviada → entregue → lida | Must | MVP |
| RF-51 | Confirmação de leitura ligada por padrão e desativável; quem desliga também deixa de ver as dos outros | Must | MVP |
| RF-52 | Estado **"retida em modo foco"**, visível só se o destinatário permitir | Should | v1 (adiado em 2026-10-22) |
| RF-53 | Estado **"não entregue / possivelmente perdida"**, com opção de reenviar (Q10 da [Visão](01-visao.md)) | Should | MVP |

## 7. Atenção e foco

| ID | Requisito | Prioridade | Fase |
|---|---|---|---|
| RF-60 | **Modo foco (Reter):** ligar manualmente ou por um tempo ("por 2 horas"); o app continua recebendo, mas só mostra as mensagens quando o modo termina | Must | v1 (adiado em 2026-10-22) |
| RF-61 | Modo foco **agendado** (ex.: todo dia das 22 h às 7 h) | Should | v1 (adiado em 2026-10-22) |
| RF-62 | Exceções no modo foco: contatos escolhidos continuam aparecendo | Could | v1 (adiado em 2026-10-22) |
| RF-63 | **Entrega em lotes:** mensagens novas (de qualquer tipo) aparecem de X em X minutos, em vez de uma a uma. **Desligada por padrão**; o intervalo é configurável pelo usuário. No MVP (PWA, sem push), vale enquanto o app está aberto | Should | v1 (adiado em 2026-10-22) |
| RF-64 | Aviso automático para quem mandar mensagem durante o modo foco | — | v1 |
| RF-65 | **Modo foco (Pausar):** o app nem sincroniza; mensagens podem se perder | — | v1 |
| RF-66 | Resumo periódico ("12 mensagens em 3 conversas") | — | Futuro |

## 8. Armazenamento e banda

| ID | Requisito | Prioridade | Fase |
|---|---|---|---|
| RF-70 | **Mídia salva uma única vez:** a mesma foto ou áudio encaminhado em várias conversas ocupa espaço e é baixado uma vez só (identificação por hash) | Must | MVP |
| RF-71 | Download sob demanda por padrão; download automático configurável | Must | MVP |
| RF-72 | Expiração automática de mídia antiga: **ligada por padrão, 30 dias**, configurável. Apaga do aparelho a mídia antiga; as mensagens de texto ficam. Mídia marcada como "guardar" ou salva na galeria não expira, e o app avisa antes da primeira limpeza | Should | v1 (adiado em 2026-10-22) |
| RF-73 | Painel de armazenamento: quanto cada conversa e cada tipo de mídia ocupa, com limpeza fácil | Should | v1 (adiado em 2026-10-22) |
| RF-74 | **Modos de banda:** Econômico / Equilibrado / Qualidade | — | v1 |

## 9. Sincronização e notificações

| ID | Requisito | Prioridade | Fase |
|---|---|---|---|
| RF-80 | Ao abrir o app ou voltar para a aba, reconectar aos relays e buscar tudo o que chegou desde a última sincronização | Must | MVP |
| RF-81 | Enquanto o app está aberto, receber mensagens em tempo real | Must | MVP |
| RF-82 | Notificações com o app fechado | — | v1 (Android: UnifiedPush; desktop: conexão própria) |

## 10. Antispam

| ID | Requisito | Prioridade | Fase |
|---|---|---|---|
| RF-90 | **Custo para enviar:** prova de trabalho (NIP-13) no que vai para quem ainda não me escreveu, calibrada para celulares simples (Q-A1, RNF-18). Sem a prova, a mensagem de quem não é contato vai para Pedidos numa seção "Possível spam", sem aviso (decidido em 2026-10-29; rejeitado: descartar). Ver docs/06 §3.8 | Should | MVP |

## Fora de escopo até segunda ordem

- Chamadas de voz e vídeo (exigem WebRTC e, muitas vezes, servidores de retransmissão TURN, que consomem banda).
- Uso da mesma conta em vários aparelhos (no MVP, trocar de aparelho = restaurar pela frase).
- Status/stories, canais, comunidades, pagamentos.

## Critérios de aceite dos fluxos principais

**Primeiro uso (RF-01, RF-03)**
- Um usuário leigo instala o PWA, cria a identidade (nome e PIN) e chega à tela inicial em menos de 2 minutos, sem ajuda.
- Ao adicionar o primeiro contato, o app pede para guardar a frase; quem guarda e passa pelo teste não vê mais o lembrete.
- Nenhum dado pessoal (telefone, e-mail, CPF) é pedido.

**Adicionar contato (RF-10, RF-11)**
- Pessoa A mostra o QR; pessoa B escaneia e as duas aparecem como contato uma da outra, e podem trocar mensagens imediatamente.
- Pessoa A envia o link de convite pelo WhatsApp; B toca no link, o app abre (ou oferece instalação) e o contato é adicionado.

**Mensagem para alguém offline (RF-20, RF-50, RF-80)**
- A envia uma mensagem com B offline: A vê "enviada".
- B abre o app 2 dias depois: a mensagem aparece; A vê "entregue" na próxima vez que abrir o app.

**Modo foco (RF-60, RF-52)** — v1, adiado em 2026-10-22
- B liga o modo foco por 1 hora. A envia 3 mensagens: nada aparece para B durante a hora.
- Se B permitiu mostrar o estado, A vê "retida em modo foco".
- Ao fim da hora, as 3 mensagens aparecem para B, na ordem.

**Mídia salva uma vez (RF-70)**
- A mesma imagem recebida em 5 conversas é baixada uma vez e ocupa o espaço de uma imagem (no painel de armazenamento quando ele existir, na v1).
- Apagar a imagem de uma conversa não a apaga das outras.

**Perda de identidade (RF-05, RF-06)**
- Num aparelho novo, digitar a frase restaura a identidade, o nome e a foto, os contatos, os grupos e as configurações. O histórico antigo e as favoritas podem não voltar, e o app avisa isso antes de o usuário trocar de aparelho.

## Questões em aberto

| # | Questão | Responsável |
|---|---|---|
| Q-F1 | ✅ Resolvida no [ADR-0001](adr/0001-protocolo-de-transporte.md): 20 membros no MVP | — |
| Q-F4 | **Busca por CPF/chave Pix (RF-15):** CPFs são fáceis de adivinhar e já vazaram em massa no Brasil. Um diretório "CPF → contato" permitiria a golpistas encontrar qualquer pessoa. Mitigações possíveis: só revelar o contato se os dois tiverem o CPF um do outro; limite de consultas. Decidir junto com a Q-A7 | Pedro (futuro) |
| Q-F5 | Detalhar a figurinha sonora (Q6 da Visão): duração máxima do áudio, formato e como aparece em apps que não a reconhecem | Pedro (v1) |
