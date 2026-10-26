# 03 — Requisitos funcionais

- **Status:** ✅ aprovado
- **Última atualização:** 2026-10-16

## Fases

| Fase | Plataforma | Objetivo |
|---|---|---|
| **MVP** | Web/PWA | Validar o núcleo: identidade, contatos, conversas 1:1 e em grupos pequenos, áudio, fotos, modo foco |
| **v1** | Android nativo (Capacitor) + desktop nativo (Tauri) | Notificações soberanas, figurinhas, modos de banda, proteção do app |
| **Futuro** | + iOS | Chamadas, grupos grandes, multi-dispositivo, forward secrecy, recuperação de conveniência |

**Prioridade dentro do MVP (MoSCoW):** **Must** = sem isso não há MVP · **Should** = importante, mas pode ser cortado se o prazo apertar · **Could** = só se sobrar tempo.

**Repriorização (decidida em 2026-10-22):** o critério para o resto do MVP passou a ser o uso no dia a dia (o que faz um grupo de amigos usar o app em vez do WhatsApp). Saíram do MVP e foram para a v1: modo foco e o estado "retida" (RF-52, 60–62), entrega em lotes (RF-63) e expiração de mídia com o painel de armazenamento (RF-72, 73). A detecção de perdas (RF-53) foi mantida no MVP.

## 1. Identidade e conta

| ID | Requisito | Prioridade | Fase |
|---|---|---|---|
| RF-01 | Criar identidade sem telefone nem e-mail: o app gera o par de chaves e o usuário escolhe um nome de exibição | Must | MVP |
| RF-02 | Foto de perfil opcional | Could | MVP |
| RF-03 | Mostrar a **frase de recuperação** (12 palavras) no cadastro, com explicação simples e um **teste de verificação** (ex.: "digite a 3ª e a 7ª palavras") | Must | MVP |
| RF-04 | Lembrete periódico para quem ainda não confirmou que guardou a frase | Should | MVP |
| RF-05 | Restaurar a identidade num aparelho novo a partir da frase | Must | MVP |
| RF-06 | Backup cifrado de contatos e configurações nos relays, restaurado junto com a identidade | Should | MVP |
| RF-07 | Bloqueio do app com PIN ou biometria do aparelho (opcional) | — | v1 |
| RF-08 | Recuperação de conveniência via passkey, Pix ou gov.br (opt-in; ver Q-A6 e Q-A7 do [02](02-modelo-de-ameacas.md)) | — | Futuro |

## 2. Contatos

| ID | Requisito | Prioridade | Fase |
|---|---|---|---|
| RF-10 | Adicionar contato escaneando o **QR code** da outra pessoa | Must | MVP |
| RF-11 | Adicionar contato por **link de convite**, que pode ser enviado por qualquer meio (inclusive pelo WhatsApp) | Must | MVP |
| RF-12 | **Pedidos de mensagem:** mensagens de quem não é contato vão para uma caixa separada, sem notificação e sem carregar links ou mídia até o usuário aceitar | Must | MVP |
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
| RF-24 | Editar mensagem enviada | Should | MVP |
| RF-25 | Apagar mensagem para todos. Num sistema descentralizado isso é um **pedido**, não uma garantia: apps de terceiros podem ignorá-lo, e o app deve deixar isso claro | Should | MVP |
| RF-26 | Busca local nas conversas | Could | MVP |
| RF-27 | Mensagens temporárias (somem após 24 h, 7 dias etc.) | — | v1 |
| RF-28 | **Selecionar várias mensagens** e agir de uma vez: favoritar, excluir (para mim ou para todos, RF-25), copiar e encaminhar. Favoritar é local. Pedido do Pedro em 2026-10-26 | — | Futuro |

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
| RF-44 | Arquivos, documentos e vídeos | — | Futuro |

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
| RF-90 | **Custo para enviar:** prova de trabalho ou limite de taxa na primeira mensagem para quem não é contato, calibrado para celulares simples (Q-A1) | Should | MVP |

## Fora de escopo até segunda ordem

- Chamadas de voz e vídeo (exigem WebRTC e, muitas vezes, servidores de retransmissão TURN, que consomem banda).
- Uso da mesma conta em vários aparelhos (no MVP, trocar de aparelho = restaurar pela frase).
- Status/stories, canais, comunidades, pagamentos.

## Critérios de aceite dos fluxos principais

**Primeiro uso (RF-01, RF-03)**
- Um usuário leigo instala o PWA, cria a identidade, passa pelo teste da frase de recuperação e chega à tela inicial em menos de 2 minutos, sem ajuda.
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
- Num aparelho novo, digitar a frase restaura a identidade, os contatos e as configurações. O histórico antigo pode não voltar, e o app avisa isso antes de o usuário trocar de aparelho.

## Questões em aberto

| # | Questão | Responsável |
|---|---|---|
| Q-F1 | ✅ Resolvida no [ADR-0001](adr/0001-protocolo-de-transporte.md): 20 membros no MVP | — |
| Q-F4 | **Busca por CPF/chave Pix (RF-15):** CPFs são fáceis de adivinhar e já vazaram em massa no Brasil. Um diretório "CPF → contato" permitiria a golpistas encontrar qualquer pessoa. Mitigações possíveis: só revelar o contato se os dois tiverem o CPF um do outro; limite de consultas. Decidir junto com a Q-A7 | Pedro (futuro) |
| Q-F5 | Detalhar a figurinha sonora (Q6 da Visão): duração máxima do áudio, formato e como aparece em apps que não a reconhecem | Pedro (v1) |
