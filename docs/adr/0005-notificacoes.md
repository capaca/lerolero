# ADR-0005: Notificações

- **Status:** aceito; a linha do PWA mudou pelo [ADR-0010](0010-web-push-no-pwa.md) em 2026-11-04
- **Data:** 2026-10-16

## Contexto

Celulares e navegadores suspendem apps em segundo plano; notificações dependem do serviço de push do fabricante ou do navegador (Google, Apple, Mozilla), o que conflita com a soberania ([Visão](../01-visao.md), princípio 2). Decisões anteriores: o PWA do MVP abre mão de push (Q7 da Visão); Android é a plataforma prioritária (princípio 10).

## Opções consideradas

- **Web Push no PWA:** funciona, mas passa por Google ou Mozilla e exige um servidor vigiando os relays.
- **UnifiedPush no Android:** padrão aberto; o usuário escolhe o distribuidor (ex.: ntfy), que pode ser operado por voluntários brasileiros.
- **Sincronização periódica sem push:** 100% soberana, mas com atraso.
- **Conexão própria no desktop:** sistemas de desktop não matam o app em segundo plano.

## Decisão

| Plataforma | Notificação |
|---|---|
| PWA (MVP) | ~~Nenhuma em segundo plano~~ → **Web Push**, enviado pelo app do remetente por um repassador mínimo ([ADR-0010](0010-web-push-no-pwa.md), 2026-11-04). Continua sincronizando ao abrir ou voltar para a aba |
| Android (v1) | **UnifiedPush**, com distribuidores operados pela comunidade brasileira; alternativa: sincronização periódica |
| Desktop (v1) | **Conexão própria** com os relays, app na bandeja, notificação do sistema |
| iOS (futuro) | APNs com push sem conteúdo |

O conteúdo da notificação **nunca** passa pelo serviço de push: o push só diz "acorde", e o app busca e decifra a mensagem.

## Consequências

- ~~PWA no MVP depende do usuário abrir o app; aceitável para validar o núcleo.~~ Mudou em 2026-11-04: o PWA ganha Web Push antes do beta ([ADR-0010](0010-web-push-no-pwa.md)).
- No Android, o usuário pode precisar instalar um distribuidor (ex.: ntfy) à parte, o que é um obstáculo para leigos (Q7 da Visão).
- Em estudo desde 2026-11-02 (Q-M2 do [roadmap](../07-roadmap.md)): Web Push no PWA antes do beta, com o "acorde" enviado pelo app do remetente e uma chave VAPID por pessoa; plano e primeiras medições em [prototipos/push](../../prototipos/push/README.md) (o FCM do Chrome recusa o CORS, então no Chrome o envio direto do navegador precisaria de um repassador; no Motorola, com o celular parado, o aviso ficou retido até o desbloqueio). ✅ Decidido em 2026-11-04 no [ADR-0010](0010-web-push-no-pwa.md): Web Push no PWA com repassador, aceitando o aviso retido com o celular parado.
- **Quem dispara o push** continua em aberto: um serviço comunitário que vigia os relays (sabe a chave pública do usuário) ou o próprio app do remetente enviando o "acorde" para o endereço de push do destinatário, compartilhado só com contatos. No PWA, decidido no ADR-0010: o app do remetente. No Android nativo, decidir antes da v1.
