# ADR-0011: App Android nativo antes do beta (push, distribuição e interface)

- **Status:** aceito (muda a linha do Android no [ADR-0005](0005-notificacoes.md) e detalha o Capacitor do
  [ADR-0002](0002-stack-do-cliente.md))
- **Data:** 2026-11-06

## Contexto

Em 2026-11-06 o app nativo com Capacitor foi adiantado da v1 para antes do beta (item 27 do
[roadmap](../07-roadmap.md)): o Web Push do PWA ([ADR-0010](0010-web-push-no-pwa.md)) deixa o aviso retido com o
celular parado (Q-M2), e o "Adicionar à tela inicial" não parece um app de verdade. Começa pelo Android; o iPhone
depende da Q-N9. Ao começar o item, três escolhas mudavam o que seria feito: o push (Q-N10), a distribuição (Q-N2) e
de onde vem a interface.

## Opções consideradas

### Push
- **FCM agora, UnifiedPush depois (escolhida).** Funciona sem passo extra e a mensagem de alta prioridade acorda o
  celular parado. Contra: passa pelo Google (como o Web Push de hoje) e o envio pela API do FCM exige uma credencial
  de servidor, que fica no repassador.
- **Só UnifiedPush.** Nada passa pelo Google, mas o testador instala e configura o ntfy à parte, obstáculo para
  leigos (Q7 da Visão). Rejeitada para o beta.
- **Os dois desde o início.** UnifiedPush quando houver distribuidor no aparelho, FCM quando não. Rejeitada pelo
  trabalho na primeira entrega.

### Distribuição
- **APK assinado no GitHub Releases (escolhida).** Custo zero; o app avisa quando sai versão nova, e quem quiser usa
  o Obtainium para atualizar sozinho.
- **Google Play já no beta.** US$ 25 uma vez, instalar e atualizar mais fácil, mas com cadastro, revisão e política da
  loja. Rejeitada para o beta.
- **APK agora e Play logo depois, dentro do item 27.** Rejeitada: a Play fica para depois do beta.

### Interface
- **Embutida no APK (escolhida).** Padrão do Capacitor; abre offline desde a primeira vez; cada versão do app é um APK.
- **Carregada do GitHub Pages.** Atualiza sem APK novo, mas o Capacitor desaconselha em produção, depende da rede na
  primeira abertura e também não compartilha os dados com o PWA. Rejeitada.

## Decisão

1. **Push pelo FCM**, com mensagem de alta prioridade. O app do remetente continua mandando o "acorde" (como no
   ADR-0010), agora com o token FCM do destinatário, que vai no cartão de perfil só para os contatos. O aviso segue
   cifrado ponta a ponta com as chaves do destinatário, levando no máximo o nome de quem mandou (T6). O repassador
   passa a guardar a credencial do Firebase para enviar pela API do FCM. O **UnifiedPush** entra depois, como opção
   para quem já tem um distribuidor. Decidido em 2026-11-11, ao começar a etapa: **um só projeto do Firebase** para
   a produção e a homologação, com os dois apps (`io.github.capaca.lerolero` e o `.homologacao`) num
   `google-services.json` só e a mesma conta de serviço nos dois repassadores; a credencial só manda aviso para
   tokens do próprio app. Rejeitados dois projetos: isolariam a homologação, mas dobram os passos no console.
2. **APK assinado no GitHub Releases**, publicado pela release, com aviso de versão nova no próprio app; Obtainium
   opcional. A Google Play fica para depois do beta (Q-N2).
3. **Interface embutida no APK.** Os dados do app ficam separados dos do PWA; a conta passa para o app pela
   recuperação de sempre (arquivo, gerenciador de senhas ou frase, [ADR-0009](0009-protecao-e-recuperacao-da-conta.md)).

## Consequências

- O aviso com o celular parado deixa de ficar retido no Android nativo.
- O repassador deixa de ser sem credencial: quem o usar pode mandar avisos (cifrados, sem conteúdo legível) para
  qualquer token FCM do app que conheça. O token só vai aos contatos; o limite por IP continua. Registrar no
  [modelo de ameaças](../02-modelo-de-ameacas.md) quando a etapa do push for feita.
- Cada release do app gera um APK; o testador precisa atualizar (o aviso no app e o Obtainium ajudam).
- Quem já usa o PWA restaura a conta no app; as conversas antigas não vêm junto (não há multi-dispositivo).
- Verificação de desenvolvedor do Google, conferida em 2026-11-07: no Brasil, desde 2026-09-30, ela só barra
  instalações vindas de lojas (Play, Galaxy Store, Xiaomi e outras de fabricantes). O APK baixado do GitHub Releases
  ou pelo Obtainium instala como antes. Em 2027, sem data marcada, passa a valer para todo APK num Android
  certificado. A partir daí, um APK sem registro só instala depois do "fluxo avançado", que se faz uma vez: modo
  desenvolvedor, reiniciar o celular e esperar 24 h. Decidido em 2026-11-07: a etapa do APK assinado segue **sem
  conta no Google**. A conta completa no Android Developer Console (US$ 25 e documento) fica para antes da regra
  global e entra na revisão de prontidão (item 23). Até lá, a chave de assinatura fica guardada com cópia segura,
  porque o registro do pacote vai pedir um APK assinado por ela. Rejeitadas: abrir a conta completa já (custo e
  cadastro antes de precisar) e a distribuição limitada (grátis, mas no máximo 20 aparelhos, sem folga para o
  beta). O pacote continua `io.github.capaca.lerolero`, que não depende do domínio (Q-N1). Rejeitado esperar o
  `.com.br` para trocar de pacote: o nome não aparece para quem usa o app, e a etapa ficaria parada.
- Rever se o beta mostrar que instalar o APK é um obstáculo grande: aí a Play (US$ 25) volta à mesa.
