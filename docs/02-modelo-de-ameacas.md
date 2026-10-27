# 02 — Modelo de ameaças

- **Status:** ✅ aprovado
- **Última atualização:** 2026-10-26

Este documento define **o que** o app protege, **de quem** protege e **quais riscos aceitamos** conscientemente. É a principal entrada para a escolha do protocolo ([ADR-0001](adr/0001-protocolo-de-transporte.md)).

## Resumo

- O **conteúdo** das mensagens é sempre protegido por criptografia ponta a ponta. Ninguém além dos participantes da conversa consegue lê-lo: nem os operadores dos relays, nem a operadora de internet, nem o projeto.
- **Metadados** (quem recebe mensagens, quando e quanto) ficam parcialmente expostos aos operadores dos relays. Isso é **aceito** no nível de proteção escolhido.
- As prioridades de defesa são **vigilância de rede** e **golpes/spam**.
- **Forward secrecy** é desejável, mas fica fora do MVP.

## Ativos protegidos

| Ativo | Descrição | Proteção |
|---|---|---|
| A1 — Conteúdo | Texto, áudio, imagens, figurinhas, arquivos | Criptografia ponta a ponta, sempre |
| A2 — Identidade | Chave privada do usuário | Fica só no aparelho; recuperável pela frase de recuperação |
| A3 — Lista de contatos | Com quem o usuário conversa | Nunca enviada em claro; backup só cifrado |
| A4 — Metadados | Quem recebe, quando, volume, IP | Proteção parcial (ver "Nível de proteção") |
| A5 — Atividade | Quando o usuário está online, leu ou está em modo foco | Controlada pelo usuário (confirmações desativáveis) |

## Adversários

| Adversário | Escopo | O que pode tentar |
|---|---|---|
| **Vigilância de rede** (operadoras de internet, Wi-Fi público, Big Techs via push) | ✅ Prioritário | Ler o tráfego, descobrir com quem o usuário fala, inferir hábitos |
| **Golpistas e spammers** | ✅ Prioritário | Golpe do falso parente, golpe do Pix, phishing, spam em massa |
| **Operadores dos relays** (voluntários, empresas, órgãos públicos) | ⚠️ Parcial | Ler mensagens (impedido pela criptografia); observar metadados (aceito); apagar ou não entregar mensagens (mitigado com vários relays) |
| **Acesso físico ao celular** (roubo, parceiro controlador) | ⚠️ Parcial | Abrir o app no celular desbloqueado. Proteção básica e opcional no app |
| **Ordens judiciais a operadores** | ❓ Em aberto | Ver Q-A3 |
| **Adversário estatal com alvo específico** (malware no aparelho, interceptação dirigida) | ❌ Fora de escopo | Nenhum mensageiro protege contra malware no próprio aparelho |

## Nível de proteção: o que cada um consegue ver

Escolha: **proteger o conteúdo**. Os metadados ficam parcialmente expostos, num nível parecido com o do WhatsApp, mas sem um dono central que concentre todos eles.

| Quem observa | Conteúdo | Com quem você fala | Quando/quanto | Seu IP |
|---|---|---|---|---|
| Operadora de internet / Wi-Fi | ❌ não vê | ❌ não vê (vê só os relays) | ⚠️ vê volume e horários | ✅ vê |
| Operador de um relay | ❌ não vê | ⚠️ vê quem **recebe**, não quem envia* | ⚠️ vê | ✅ vê |
| Serviço de push (Google/Apple/Mozilla) | ❌ não vê (push sem conteúdo) | ❌ não vê | ⚠️ vê que algo chegou | ✅ vê |
| Projeto / autor do app | ❌ não vê | ❌ não vê | ❌ não vê | ❌ não vê |
| Outros participantes da conversa | ✅ veem | — | ✅ veem (se confirmações ligadas) | ❌ não veem |

\* Depende do protocolo escolhido no ADR-0001. No Nostr com NIP-17, o remetente fica oculto do relay, mas o destinatário não.

Como os usuários espalham suas mensagens por vários relays independentes, **nenhum operador sozinho tem a visão completa**, ao contrário do WhatsApp.

## Ameaças e mitigações

| ID | Ameaça | Mitigação | Quando |
|---|---|---|---|
| T1 | Operadora ou Wi-Fi lê o tráfego | Conexão sempre cifrada (WSS/TLS) + criptografia ponta a ponta | MVP |
| T2 | Operadora infere conversas pelo tamanho das mensagens | Padding: as mensagens são completadas até tamanhos padronizados | MVP |
| T3 | Relay lê o conteúdo | Criptografia ponta a ponta | MVP |
| T4 | Relay apaga ou deixa de entregar mensagens | Publicar em vários relays (3 a 5); detecção de perda (Visão, Q10) | MVP |
| T5 | Relay monta o mapa de quem fala com quem | Ocultar o remetente (se o protocolo permitir); espalhar por vários relays. Risco residual aceito | MVP |
| T6 | Serviço de push vê conteúdo | Push sem conteúdo, só "acorde" | Android nativo |
| T7 | Spam em massa de desconhecidos | **Pedidos de mensagem:** desconhecidos vão para uma caixa separada, sem notificação e sem carregar links ou mídia até o usuário aceitar | MVP |
| T8 | Spam automatizado em grande volume | **Custo para enviar:** prova de trabalho ou limite de taxa para a primeira mensagem a quem não é contato | MVP ou v1 |
| T9 | Golpe do falso parente (golpista usa nome e foto de um conhecido) | Pedidos de mensagem (T7) já separam o desconhecido. Mais mecanismos em estudo (Q-A4) | MVP + futuro |
| T10 | Celular roubado ou acessado por terceiros | **Opcional:** PIN/biometria próprios do app e mensagens temporárias | v1 |
| T11 | Perda do celular = perda da identidade | **Frase de recuperação** (12 palavras) + backup cifrado de contatos e configurações nos relays | MVP |
| T12 | Vazamento da chave expõe todo o histórico | Risco aceito no MVP. Forward secrecy no futuro (Double Ratchet ou MLS) | Futuro |
| T14 | Adivinhar o PIN pelo próprio app, com o celular na mão | **Espera crescente:** 5 tentativas livres, depois 30 s, 1 min, 5 min, 15 min e 1 h por tentativa (contador único para desbloquear e para ver a frase). Testar o milhão de PINs de 6 dígitos vira mais de um século | MVP |
| T15 | Copiar os dados do navegador (celular com root, computador destravado, perícia) e testar os PINs fora do app | **Limitação conhecida do PWA:** o Argon2id encarece cada tentativa, mas sem limite de tentativas 1 milhão de PINs pode cair em horas com placas de vídeo. O PIN do PWA protege contra quem pega o celular, não contra quem extrai os dados. No app nativo (v1), o cofre de hardware do sistema (Android Keystore etc.) guarda a chave e limita as tentativas | MVP (aceito) → v1 |
| T16 | Pegar o celular logo depois de a pessoa usar o app e recarregar a página para entrar sem o PIN | **Sessão aberta por 5 minutos** (decidido em 2026-10-22, para não pedir o PIN a cada recarga): a chave privada fica cifrada com uma chave AES não exportável guardada no aparelho, e o PIN só volta a ser pedido depois de 5 minutos fora da tela. "Bloquear agora" apaga a sessão. Quem copia os dados do navegador nesse intervalo leva a chave sem precisar do PIN, o que já está coberto pelo T15 | MVP (aceito) |
| T17 | Num grupo, sem servidor para dar a ordem, um membro forja avisos de grupo: se diz administrador, muda o horário de entrada para herdar o título de criador, ou, depois de removido, manda avisos com horário de antes da remoção | Cada aparelho refaz o estado a partir dos avisos e só aceita o que o autor podia fazer naquele momento (docs/06 §3.3); o horário de entrada é o do aviso e o herdeiro é calculado em cada aparelho; quem entra parte do primeiro aviso que **chegou** e o adiciona. **Horário falso** (decidido pelo Pedro em 2026-10-22): aviso de quem perdeu o papel de administrador não vale se chegou depois da perda, mesmo com horário de antes. Sobram casos raros: um aviso legítimo feito sem internet antes da remoção, que pode valer em uns aparelhos e não em outros, e um aparelho restaurado pela frase, que recebe tudo fora de ordem e pode aceitar o aviso falso. O aviso aparece na conversa e o criador pode desfazer | MVP |
| T13 | Confirmações de leitura revelam a atividade | Ligadas por padrão, desativáveis (quem desliga também deixa de ver as dos outros). O estado "em modo foco" só aparece se o usuário quiser | MVP |
| T18 | Endereço malicioso numa mensagem: phishing parecido com o de um banco ou parente, rastreio do IP de quem toca no link, endereço do app vazando pelo `Referer` | Só `http` e `https` viram link; abre em aba nova com `noopener noreferrer`; mostra o domínio inteiro; **sem prévia** (o app nunca busca a página); em pedido de mensagem de desconhecido continua texto até aceitar (T7) | M3 |
| T19 | Perder a conta antes de guardar a frase: o navegador apaga os dados do site, o celular some ou a pessoa esquece o PIN ("Esqueci o PIN" também pede a frase) | **Risco aceito** com a frase depois do cadastro (2026-10-26, Q-U1 do [07](07-roadmap.md)): sem contatos quase não há o que perder, e a frase é pedida ao ganhar o primeiro contato, com lembrete até ser conferida (RF-03, RF-04). O aviso para instalar no iPhone reduz a chance de o navegador apagar os dados; o pedido de armazenamento persistente (`navigator.storage.persist()`, [ADR-0003](adr/0003-armazenamento-local.md)) é feito a cada desbloqueio, no máximo uma vez por dia até ser concedido (2026-10-27: antes só no cadastro, onde o Chrome costuma negar) | MVP |

## Decisões tomadas nesta etapa

- **Nível de proteção:** só o conteúdo (resolve a Q5 da Visão).
- **Forward secrecy:** desejável, fora do MVP. O protocolo escolhido precisa ter um caminho para adicioná-la depois.
- **Confirmações de entrega e leitura:** ligadas por padrão, desativáveis, no modelo do WhatsApp. Visibilidade do modo foco é opt-in (resolve a Q9 da Visão).
- **Acesso físico:** confiamos no bloqueio do celular; o app oferece proteção básica opcional.
- **Recuperação de conta:** **frase de recuperação + backup cifrado**. 12 palavras restauram a identidade; contatos e configurações voltam do backup cifrado nos relays. O histórico antigo pode não voltar.
- **Recuperação social descartada:** dividir a chave entre contatos de confiança permitiria que contatos em conluio tomassem a identidade do usuário.
- **Biometria (rosto/voz) descartada como recuperação:** biometria não é segredo (fotos e áudios são públicos, e a voz pode ser clonada por IA), não pode ser trocada se vazar e exigiria um servidor central guardando dados sensíveis (LGPD, art. 11). Biometria serve apenas para **destravar o app no próprio aparelho** (T10).
- **Antispam:** pedidos de mensagem + custo para enviar. *Tradeoff:* prova de trabalho gasta bateria e processamento, o que conflita com o princípio "leve e inclusivo". O custo precisa ser calibrado para celulares simples.

## Riscos aceitos

| Risco | Por que aceitamos |
|---|---|
| Relays veem quem recebe mensagens, quando e o IP | Esconder isso exigiria onion routing (mais dados, mais lento), o que conflita com celular simples e rede ruim |
| Sem forward secrecy no MVP | Simplifica muito o início; o público-alvo não exige proteção de nível ativista |
| Perda de mensagens no modo Pausar | Por design, para não sobrecarregar os relays (Visão) |
| Serviços de push veem que algo chegou | Inevitável no iOS e no PWA; no Android nativo o UnifiedPush reduz essa exposição |

## Requisitos para o protocolo (entrada para o ADR-0001)

O protocolo escolhido deve:

1. ter criptografia ponta a ponta do conteúdo, com padding;
2. funcionar com vários relays ou servidores independentes, sem dono central;
3. permitir que o destinatário receba mensagens estando offline (armazenamento temporário);
4. preferencialmente ocultar o remetente dos relays;
5. ter um caminho conhecido para forward secrecy (ex.: MLS para grupos, Double Ratchet para 1:1);
6. permitir derivar a identidade a partir de uma frase de recuperação;
7. permitir armazenar dados cifrados do próprio usuário (backup de contatos e configurações);
8. ter algum suporte a prova de trabalho ou limite de taxa;
9. funcionar com consumo baixo de dados e de bateria.

## Questões em aberto

| # | Questão | Responsável |
|---|---|---|
| Q-A1 | Calibrar a prova de trabalho: qual custo é aceitável num Android de entrada sem prejudicar o usuário legítimo? | ✅ Meta definida em [04](04-requisitos-nao-funcionais.md) (RNF-18: < 1 s no aparelho de referência) |
| Q-A2 | Como ajudar leigos a guardar a frase de recuperação com segurança (onboarding, lembretes, teste de verificação)? Perder a frase significa perder a identidade | ✅ Resolvida em [03](03-requisitos-funcionais.md) (RF-03 teste de verificação, RF-04 lembretes) |
| Q-A3 | **Ordens judiciais e Marco Civil:** como os operadores de relays no Brasil devem lidar com ordens judiciais? Atenção: o art. 15 do Marco Civil da Internet obriga provedores de aplicação organizados como pessoa jurídica, com fins econômicos, a guardar registros de acesso por 6 meses. Isso pode afetar empresas e órgãos que operem relays, mas provavelmente não voluntários pessoa física. Discutir na etapa jurídica/LGPD | ➡️ Encaminhada em [04](04-requisitos-nao-funcionais.md) (Q-N3) |
| Q-A4 | Mais mecanismos antigolpe para o futuro: verificação de contato por QR presencial, alerta de "contato com chave nova", alertas locais para pedidos de Pix e de códigos | ➡️ Encaminhada para o futuro em [03](03-requisitos-funcionais.md) (RF-16) |
| Q-A5 | Oferecer Tor ou proxy como opção avançada para quem quiser esconder o IP? | ✅ Resolvida em [04](04-requisitos-nao-funcionais.md): não; quem quiser usa VPN/Orbot no sistema |
| Q-A6 | **Passkeys como recuperação de conveniência:** identidade cifrada com uma passkey, recuperada num celular novo com rosto/digital. Muito amigável para leigos, mas a passkey é sincronizada pelo Google ou pela Apple (conflita com soberania). Só como opção, nunca no lugar da frase. Avaliada em 2026-10-26 (Q-U1 do [07](07-roadmap.md)) e **adiada para depois da decisão do domínio (Q-N1)**: a passkey fica presa ao domínio que a criou (trocar de domínio, a homologação e os apps nativos precisam de associação), a extensão PRF do WebAuthn tem suporte desigual e não atravessa do Android para o iPhone, e a custódia passa a depender da conta Google ou Apple. Custo estimado de 2 a 3 semanas. Bônus: a mesma PRF poderia abrir o app com a digital no lugar do PIN (RF-07) | Pedro (futuro) |
| Q-A7 | **Recuperação via Pix ou gov.br:** provar a identidade (Pix a partir da própria conta bancária, ou login gov.br com verificação facial) para um *custodiante* liberar uma cópia cifrada da chave. Exige custodiante central (ou vários, com limiar), vincula a identidade ao CPF (fim do anonimato, dado sensível na LGPD), tem custo de integração bancária e herda o risco de contas bancárias invadidas. Só faria sentido como opção, possivelmente numa parceria com instituições públicas | Pedro (futuro) |
