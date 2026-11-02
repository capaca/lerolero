# Protótipo: notificações por Web Push no PWA

Plano registrado em 2026-11-02; as páginas ficaram prontas no mesmo dia. Falta a medição no Motorola.

Mede, num aparelho de verdade, se o PWA instalado recebe um aviso de mensagem nova com o app fechado, enviado direto
pelo navegador de quem manda, sem servidor do projeto. O resultado decide se o PWA ganha notificações antes do beta
(Q-M2 do [roadmap](../../docs/07-roadmap.md)). Hoje o [ADR-0005](../../docs/adr/0005-notificacoes.md) diz que o PWA
não tem notificação; ele só muda depois da medição.

## Por que

Sem notificação, quem testa o beta precisa lembrar de abrir o app, e o beta mede mais o esquecimento do que o app.

Alternativas consideradas em 2026-11-02:

| Caminho | Prós | Contras |
|---|---|---|
| **Web Push no PWA** (este protótipo) | Nada a instalar; quase instantâneo; sem APK nem Play Store; as atualizações continuam em 5 minutos (item 17); chega ao iPhone (iOS 16.4+, PWA instalado) | O Google vê o horário dos avisos (no Chrome o endereço de push é do FCM); sem serviços do Google, sem aviso; talvez precise de um repassador (CORS) |
| App nativo (Capacitor) com FCM e um gateway gratuito | Funciona sem a pessoa fazer nada; prioridade no modo Doze; testado em escala (Signal) | O mesmo metadado ao Google; primeiro servidor do projeto, com credencial do Firebase na CI; APK com "fontes desconhecidas" ou Play Store (teste fechado de 12 pessoas por 14 dias para conta nova); APK direto não se atualiza sozinho; duas versões para manter; texto genérico com o app fechado; ~2 semanas e atrasa o beta |
| App nativo com UnifiedPush (o plano da v1) | Soberano, sem Google | A pessoa instala um distribuidor (ntfy) à parte, o que trava leigos; ~2 a 3 semanas |
| App nativo com sincronização periódica | Sem servidor nem Google; ~1 semana | Atraso de 15 min ou mais; fabricantes matam o app; mesmos contras de instalação e atualização do nativo |

## A ideia: cada pessoa com a própria chave VAPID

O que costuma exigir servidor no Web Push é a assinatura VAPID, cuja chave é um segredo único do site. Aqui, cada
pessoa tem a sua:

1. Ao ativar as notificações, o app gera um par de chaves VAPID só daquela pessoa e se inscreve
   (`pushManager.subscribe`, `userVisibleOnly`) com a pública. O navegador devolve o endereço de push e as chaves de
   cifra (`p256dh`, `auth`).
2. Endereço, chaves de cifra e a chave VAPID **privada** vão no cartão de perfil (item 8), que só os contatos recebem.
3. Ao mandar uma mensagem, o app do remetente cifra o aviso (RFC 8291, `aes128gcm`) para o destinatário, assina o JWT
   com a chave VAPID dele e faz o POST direto no endereço de push. Na fila offline, o aviso sai quando a fila esvazia.
   Em grupo, um aviso por membro.
4. O service worker do destinatário acorda com o evento `push` e mostra a notificação. O aviso vai cifrado só para o
   navegador dele, então pode levar o nome de quem mandou ("Mensagem de Maria") sem o Google ver; **nunca o conteúdo**
   (ADR-0005).
5. Ao bloquear alguém, o app gera chaves novas, se inscreve de novo e manda o cartão atualizado só aos contatos que
   ficaram: quem foi bloqueado deixa de conseguir acordar a pessoa.

Riscos: um contato pode mandar avisos em excesso (resolve bloqueando); o aviso só sai se o remetente tiver a versão
do app que manda avisos; ele falha se o remetente perder a rede logo depois de enviar.

## O que medir

HTML e JavaScript puros, como o [`prototipos/senha`](../senha/README.md), sem build nem biblioteca: a homologação
copia a pasta para `/lerolero/push/`. A cifra (RFC 8291) e o JWT VAPID (RFC 8292) usam só o WebCrypto e foram
conferidos contra o `http_ece`, a biblioteca do `web-push`.

| Página | Papel |
|---|---|
| `index.html` | Destinatário: ativa (chave VAPID própria e inscrição), compartilha o convite por link, lista os avisos que o service worker anotou (hora, atraso, se havia janela aberta, nome lido no IndexedDB) |
| `enviar.html` | Remetente: abre pelo link do convite, cifra, assina e faz o POST, na hora ou depois de N minutos; também gera o mesmo pedido como comando `curl` |
| `sw.js` | Acorda com o push, anota no IndexedDB e mostra "Mensagem de …" |

| Pergunta | Por que importa |
|---|---|
| O POST direto do navegador ao endereço de push passa, ou o CORS bloqueia? | Decide se precisa de repassador |
| O aviso chega com o PWA fechado? Com a tela apagada há 30 min (Doze)? Depois de reiniciar o celular? | Se só funcionar aberto, não serve |
| Quanto tempo do envio à notificação? | Esperado: segundos |
| O service worker lê o nome do contato no banco local (IndexedDB)? | Nome no aviso ou buscado no aparelho |
| Chrome no computador, Firefox no Android (push da Mozilla) | Alcance |
| iPhone com o PWA instalado | Quando houver um aparelho, como no item 14 |

Aparelhos: o Motorola Edge 60 do Pedro como destinatário e o computador (ou outro celular) como remetente. Estimativa:
2 a 3 dias.

### Como medir

1. No Chrome do Motorola, abra https://lerolero-app.github.io/lerolero/push/ e instale (menu → Instalar app; nome
   "Lero push", verde-azulado). No app instalado, toque em Ativar e permita as notificações.
2. "Compartilhar o link" e mande para o computador. Abra lá: o convite vem preenchido em `enviar.html`.
3. Feche o app no celular (tirar dos recentes). No computador, "Enviar pelo navegador"; se falhar por CORS (esperado
   no Chrome, ver abaixo), "Gerar comando curl" e rode no terminal logo em seguida.
4. Celular dormindo: apague a tela, espere 30 min ou mais (no computador, "Esperar" 30 minutos com a página aberta, ou
   o `curl` depois). Repita depois de reiniciar o celular, sem abrir o app.
5. "Trocar as chaves" no celular e mande de novo pelo link antigo: o serviço deve recusar com 410 (é o corte ao
   bloquear). A página do remetente mostra o começo da chave VAPID do link, para conferir com a do celular.
6. "Copiar resultados (JSON)" nas duas páginas e cole no registro.
7. Firefox no Android: repita 1 a 3 no Firefox (push da Mozilla, que aceita o CORS).

Para rodar no computador: `python3 -m http.server -d prototipos` e abra `http://localhost:8000/push/` (os ícones não
aparecem fora do site).

### Medido no computador (2026-11-02)

Chrome 156 no macOS, perfil novo, destinatário e remetente na mesma máquina:

- **O FCM recusa o CORS.** O preflight do POST ao endereço `fcm.googleapis.com/fcm/send/…` volta sem
  `Access-Control-Allow-Origin`, e o fetch falha. Pelo `curl` com o mesmo pedido, o FCM responde 201: a assinatura e a
  cifra estão certas, só o navegador é barrado. O mesmo preflight, sondado com `curl`, passa no push da Mozilla
  (`updates.push.services.mozilla.com` devolve a origem da homologação) e falha no da Apple (`web.push.apple.com`, 405).
- **Pelo `curl`, o aviso chegou em 0,6 s numa rodada e 25 s na outra** (inscrições recém-criadas; o atraso no
  celular é o que vale), e o service worker leu o nome do contato no IndexedDB.

Ou seja, no Chrome (o caso do Motorola) o envio direto do navegador não passa: precisa de um repassador, ou o envio
fica só para quem usa Firefox. O que falta medir no celular (app fechado, Doze, reinício) não depende disso e pode ser
feito pelo `curl`.

## O que cada resultado decide

- **O POST passa e o aviso chega com o celular dormindo:** notificações no PWA antes do beta, em ~1 a 1,5 semana
  (ativar em Ajustes, inscrição no cartão de perfil, aviso no envio e na fila offline, service worker, troca de chaves
  ao bloquear). Sem servidor e sem app nativo. Aditivo no ADR-0005.
- **O CORS bloqueia:** um repassador mínimo que só encaminha o POST, sem guardar nada nem ter credencial (a assinatura
  vem do remetente). Decidir se aceita o primeiro servidor do projeto.
- **Não chega com o celular dormindo:** o Web Push não resolve no Android; volta a escolha do app nativo (tabela
  acima).
