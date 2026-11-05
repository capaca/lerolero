# ADR-0010: Web Push no PWA antes do beta

- **Status:** aceito (muda a linha do PWA no [ADR-0005](0005-notificacoes.md))
- **Data:** 2026-11-04

## Contexto

Sem notificação, quem testa o beta precisa lembrar de abrir o app, e o beta mede mais o esquecimento do que o app
(Q-M2 do [roadmap](../07-roadmap.md)). O [ADR-0005](0005-notificacoes.md) deixava o PWA sem notificação e o
UnifiedPush para o Android nativo da v1.

O protótipo [prototipos/push](../../prototipos/push/README.md) mediu, em 2026-11-02:

- **No computador:** o FCM do Chrome recusa o CORS, então o navegador do remetente não consegue fazer o POST direto
  (no Firefox passaria). Pelo `curl`, o mesmo aviso chega.
- **No Motorola Edge 60, PWA fechado:** 3,9 s com o celular na mão. Com ele parado, o aviso ficou retido até o
  desbloqueio (até 5,9 min), mesmo com `Urgency: high`, com a bateria do Chrome em "Otimizado".

A noite parada e a bateria "Sem restrições" não foram medidas: o Pedro decidiu sem elas.

## Opções consideradas

### Opção A — Web Push no PWA com um repassador mínimo (escolhida)
- Prós: nada a instalar; segundos com o celular acordado e, parado, o aviso aparece ao desbloquear; sem APK nem Play
  Store; as atualizações continuam em 5 minutos; chega também ao iPhone (iOS 16.4+, PWA instalado); ~1,5 semana.
- Contras: primeiro servidor do projeto (o repassador); o Google vê o horário dos avisos; não acorda o celular parado
  no Motorola; sem serviços do Google, sem aviso.

### Opção B — Nada antes do beta (rejeitada)
- Prós: nenhum trabalho nem servidor; o beta sai antes.
- Contras: o beta depende de a pessoa lembrar de abrir o app.

### Opção C — App nativo (Capacitor) com FCM e um gateway (rejeitada)
- Prós: a mensagem de alta prioridade do FCM acorda o Android no modo Doze; funciona sem a pessoa fazer nada.
- Contras: ~2 semanas antes do beta; gateway com a credencial do Firebase; APK com "fontes desconhecidas" (sem
  atualização sozinho) ou Play Store (teste fechado de 12 pessoas por 14 dias); duas versões para manter; texto
  genérico com o app fechado; o e2e não cobre a casca nativa; não chega ao iPhone.

### Opção D — UnifiedPush ou sincronização periódica no nativo (continuam na v1)
- Contras para o beta: distribuidor à parte (ntfy) que trava leigos, ou atraso de 15 min ou mais; mesmos custos de
  instalação do nativo.

## Decisão

Notificações por Web Push no PWA antes do beta, como no protótipo:

1. Cada pessoa gera o próprio par de chaves VAPID ao ativar as notificações e se inscreve no navegador.
2. Endereço de push, chaves de cifra e a chave VAPID privada vão no cartão de perfil, que só os contatos recebem.
3. O app do remetente cifra o aviso para o destinatário (RFC 8291, `aes128gcm`), assina o JWT com a chave VAPID dele e
   manda o pedido ao **repassador**, que só o encaminha ao serviço de push. Na fila offline, o aviso sai quando ela
   esvazia; em grupo, um aviso por membro.
4. O aviso leva no máximo o nome de quem mandou, nunca o conteúdo (ADR-0005, T6). O service worker mostra a
   notificação e, ao tocar, abre a conversa.
5. Ao bloquear alguém, chaves e inscrição novas, com o cartão atualizado só aos contatos que ficaram.

O **repassador** não guarda nada nem tem credencial (a assinatura vem do remetente). Só aceita encaminhar para os
serviços de push conhecidos (Google, Mozilla, Apple, Microsoft), para não virar um proxy aberto. Hospedagem: **Cloudflare
Workers**, no plano gratuito (100 mil pedidos por dia), com deploy pela CI (decidido em 2026-11-04; rejeitados Deno
Deploy, por limites menos previsíveis, e funções da Netlify ou da Vercel, pensadas para um site inteiro e mais lentas
na primeira chamada).

No repassador (decidido em 2026-11-04, `packages/repassador`): **120 pedidos por minuto por IP**, que cabe a rajada
de uma mensagem num grupo grande (rejeitados 60, que perderia avisos em grupo com mensagens seguidas, e 300, que
protege menos o limite diário); **só as origens do app** (produção; na homologação também localhost e a rede local),
para outro site não usá-lo pelo navegador dos visitantes (rejeitado aceitar qualquer origem, que serviria a forks em
outros domínios). Um worker para a homologação, a cada merge, e outro para a produção, na release; conta da
Cloudflare que o Pedro já usa em outro projeto.

Na etapa 2 (decidido em 2026-11-04, detalhes em [docs/06 §3.11](../06-protocolo-e-dados.md)): o cartão, e com ele
os aparelhos de push, vai também a quem está num grupo comigo, porque o grupo aceito conta como aceite dos membros
(rejeitado mandar só a contatos aceitos); e cada conta tem **até 3 aparelhos** no cartão, que combinam a lista entre
si por um aviso só para mim mesmo (kind `4445`; rejeitado "só o último que ativou").

Aceito: com o celular parado, o aviso pode ficar retido até o desbloqueio. Para o beta, ainda é melhor do que lembrar
de abrir o app.

## Consequências

- O projeto passa a ter um servidor, pequeno e sem estado: se cair, as mensagens continuam chegando, só sem aviso. É
  preciso cuidar da conta, do limite gratuito e de abuso (limite de pedidos).
- O repassador vê o IP de quem manda e o endereço de push de quem recebe, mas não o conteúdo do aviso (cifrado) nem as
  chaves Nostr. Entra no [modelo de ameaças](../02-modelo-de-ameacas.md).
- O Google (ou a Mozilla, ou a Apple) vê o horário dos avisos de quem ativa. Notificação é opcional e o app funciona
  sem ela, então o princípio 1 da [Visão](../01-visao.md) (nenhuma peça essencial numa Big Tech) continua valendo.
- Um contato pode mandar avisos em excesso; resolve bloqueando. O aviso só sai se o remetente tiver a versão que manda
  avisos.
- A v1 continua com o UnifiedPush no Android; a pergunta de "quem dispara o push" (ADR-0005) já tem a resposta para o
  PWA: o app do remetente.
- Rever se o beta mostrar que o aviso retido não basta: aí volta o app nativo com FCM (opção C), que é a que acorda o
  celular no modo Doze.
