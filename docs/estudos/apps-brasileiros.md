# Estudo — Apps de mensagens brasileiros

- **Data do levantamento:** 2026-10-22
- **Objetivo:** comparar o Lero-lero com os mensageiros feitos no Brasil, para achar limitações e oportunidades.
- **Método:** buscas na web e leitura do que cada projeto publica sobre si (site, README, loja de apps). Nada foi
  instalado nem auditado. Apps pequenos podem ter ficado de fora.

## Resumo

Nenhum app brasileiro encontrado junta, ao mesmo tempo, **sem número de telefone**, **protocolo aberto**, **ninguém
dono da rede** e **custo zero**. O espaço descrito na [visão](../01-visao.md) continua vazio.

## Comparação

| | Bate-Papo | ZAP do Brasil | ZapZap | msg gov | Lero-lero |
|---|---|---|---|---|---|
| O que é | Projeto aberto de uma pessoa, sucessor do Prosa (arquivado) | Produto comercial | App de 2014 feito sobre o Telegram | App do Estado (Abin, com UFC e Serpro) | Este projeto |
| Quem controla o servidor | Quem quiser rodar um (Go + PostgreSQL); federação só no plano | A empresa; não diz onde ficam os servidores | O Telegram, fora do Brasil | O Estado (Serpro) | Ninguém: relays Nostr públicos |
| Exige telefone | Sim, com SMS | Sim (o plano é ligado ao número) | Não, usa nome de usuário | Exige credencial de segurança | Não |
| Código aberto | Sim (GPL-3.0) | Não informa | Não | Não (código restrito) | Sim |
| Interoperável | Não | Não | Na prática, só com o Telegram | Não | Sim (Nostr) |
| Criptografia | Desenho do Signal (X3DH + Double Ratchet), sem auditoria | Diz usar o Signal Protocol, sem auditoria | A do Telegram (não é ponta a ponta por padrão) | Camada comercial + camada de Estado | NIP-44/59, sem auditoria |
| Estado | MVP: servidor e SDK prontos, app móvel por fazer; 8 commits | No ar em Android, iOS e web | 12 milhões de downloads em 2018; estado atual desconhecido | Beta, só para o Sistema Brasileiro de Inteligência | No ar como PWA, com conversas 1:1 e grupos |
| Custo e modelo | Quem hospeda paga | Plano grátis com cotas + planos pagos (Arara e Onça) | Anúncios em canais | Dinheiro público | Custo zero |
| Toque brasileiro | Hospedagem no Brasil | Amigo secreto, resumo e checagem de áudio, "Me Atualiza" | O nome e a interface | Soberania do Estado | Modo foco, franquia de dados, figurinha sonora |

Também apareceu o **Secretly** (em português, sem telefone, AGPL-3.0, só iOS e Mac), mas a empresa parece não ser
brasileira ("Secretly SIA"), por isso ficou fora da tabela.

## Limitações do Lero-lero que a comparação mostra

1. **Sem forward secrecy.** Bate-Papo e ZAP usam Double Ratchet: quem rouba a chave hoje não lê as mensagens
   antigas. No Lero-lero, a chave vazada abre todo o histórico guardado nos relays. Já é risco aceito no MVP
   ([T12](../02-modelo-de-ameacas.md)), mas é a maior desvantagem técnica diante dos dois.
2. **Soberania ainda no papel.** Não há relay Nostr operado no Brasil que se conheça. O único relay em português
   encontrado (`lang.relays.land/pt`) é para notas públicas e funciona por convite.
3. **Recuperação de conta.** A frase de 12 palavras é segura, mas quem a perde perde a conta. ZAP (backup com chave
   de 64 dígitos) e Bate-Papo (PIN + código de recuperação, alerta de troca de chip) contam com o número de telefone
   como apoio.
4. **Fora das lojas.** O ZAP está no Google Play e na App Store. Um PWA não aparece para quem procura "app brasileiro"
   na loja, e no iOS as notificações são limitadas. Os apps nativos estão previstos na v1 ([roadmap](../07-roadmap.md)).
5. **Sem auditoria.** Nisso ninguém está à frente: nenhum dos apps abertos foi auditado.

## Oportunidades

1. **"Ninguém consegue desligar."** O ZapZap cresceu quando a Justiça bloqueou o WhatsApp no Brasil (2015–2016), mas
   rodava inteiro sobre o Telegram. O Lero-lero pode contar a história ao contrário: se o WhatsApp sair do ar, o
   Lero-lero continua. Nenhum dos outros pode dizer isso.
2. **Recursos com cara de Brasil, sem pedágio.** O ZAP mostra que há procura por amigo secreto, resumo de áudio e
   checagem de fatos, mas cobra por isso e não explica onde a IA roda, se diz não ler as mensagens. O Lero-lero
   pode oferecer o mesmo espírito (resumo periódico, modo foco) de graça e sem servidor lendo nada.
3. **Universidades.** Quem implementou o msg gov foi a UFC. É um precedente concreto de universidade federal em
   mensageria soberana, útil quando chegarem as parcerias para operar relays previstas na visão.
4. **Bate-Papo como aliado.** Mesma missão, arquitetura diferente, também com um autor só. Ele é forte onde o
   Lero-lero é fraco (ratchet, recuperação) e vice-versa (telefone obrigatório, servidor próprio, sem
   interoperabilidade). Vale uma conversa com o autor: troca de aprendizado, ou até o Bate-Papo usar Nostr como
   transporte em vez de criar uma federação própria.
5. **Primeiro relay Nostr do Brasil.** Ninguém ocupa esse lugar. Um relay brasileiro, mesmo pequeno, tira a
   soberania do papel e faz do Lero-lero o ponto de encontro do Nostr em português.

## Fora deste estudo

Os apps globais descentralizados (SimpleX, Session, Briar, Element/Matrix e clientes Nostr como o 0xchat) competem
mais diretamente com o Lero-lero do que os brasileiros. Ficam para um estudo próprio.

## Fontes

- [Bate-Papo (GitHub)](https://github.com/rodrigoffonseca/bate-papo) e [Prosa (arquivado)](https://github.com/rodrigoffonseca/prosa-msgapp)
- [ZAP do Brasil](https://zapdobrasil.com.br/) e [planos](https://zapdobrasil.com.br/planos)
- [ZapZap, Olhar Digital (2018)](https://olhardigital.com.br/2018/06/08/noticias/zapzap-conheca-o-whatsapp-brasileiro-com-mais-de-10-milhoes-de-downloads/)
- msg gov: [SITE PD](https://sitepd.org.br/2026/09/09/brasil-avanca-com-aplicativo-nacional-para-comunicacoes-sensiveis-de-estado/),
  [Canaltech](https://canaltech.com.br/apps/brasil-cria-regras-para-novo-whatsapp-do-governo-conheca-mensageiro-oficial/),
  [CNN Brasil](https://www.cnnbrasil.com.br/blogs/teo-cury/politica/whatsapp-estatal-abin-comeca-a-usar-novo-app-com-criptografia-de-estado/)
- [Secretly (App Store)](https://apps.apple.com/br/app/secretly-mensageiro-seguro/id6760417329)
- [Relay Nostr em português](https://lang.relays.land/pt)
- [Bloqueio do WhatsApp no Brasil, MIT Technology Review (2016)](https://www.technologyreview.com/2016/05/04/160364/brazilians-will-always-remember-the-great-whatsapp-blackout-of-2016/amp/)
