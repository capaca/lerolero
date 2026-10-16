# ADR-0005: Notificações

- **Status:** aceito
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
| PWA (MVP) | **Nenhuma** em segundo plano. Sincroniza ao abrir ou voltar para a aba |
| Android (v1) | **UnifiedPush**, com distribuidores operados pela comunidade brasileira; alternativa: sincronização periódica |
| Desktop (v1) | **Conexão própria** com os relays, app na bandeja, notificação do sistema |
| iOS (futuro) | APNs com push sem conteúdo |

O conteúdo da notificação **nunca** passa pelo serviço de push: o push só diz "acorde", e o app busca e decifra a mensagem.

## Consequências

- PWA no MVP depende do usuário abrir o app; aceitável para validar o núcleo.
- No Android, o usuário pode precisar instalar um distribuidor (ex.: ntfy) à parte, o que é um obstáculo para leigos (Q7 da Visão).
- **Quem dispara o push** continua em aberto: um serviço comunitário que vigia os relays (sabe a chave pública do usuário) ou o próprio app do remetente enviando o "acorde" para o endereço de push do destinatário, compartilhado só com contatos. Decidir antes da v1.
