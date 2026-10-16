# 01 — Visão

- **Status:** ✅ aprovado
- **Última atualização:** 2026-10-16

## Problema

Os mensageiros mais usados no Brasil (WhatsApp, Messenger, Telegram) pertencem a grandes empresas estrangeiras. Isso tem várias consequências:

- Uma única empresa, sujeita a leis e interesses de outro país, decide as regras, coleta metadados, pode mudar os termos de uso e pode encerrar ou bloquear o serviço.
- A comunicação cotidiana de milhões de brasileiros, de famílias a negócios, movimentos sociais e imprensa, depende de infraestrutura que o país não controla.
- A identidade do usuário fica presa a um número de telefone e a uma conta controlada pela empresa. Usuários e comunidades não conseguem sair levando sua identidade e seus contatos.

## Proposta

Um aplicativo de mensagens **brasileiro, independente e descentralizado**, que funcione como alternativa aos apps das Big Techs:

- **Soberania tecnológica:** nada essencial depende de empresas estrangeiras, e a rede pode ser mantida por operadores no Brasil.
- **Nenhuma entidade é dona da rede**, nem mesmo o autor do app. As mensagens trafegam por uma rede aberta, mantida por vários operadores independentes.
- **Custo zero de infraestrutura para o autor.** O app usa infraestrutura pública, gratuita e comunitária.
- **Criptografia ponta a ponta** em todas as conversas.
- **Pensado para a realidade brasileira:** celulares simples, internet ruim, pouca franquia de dados, muito áudio, muitos grupos e muita figurinha.

## Foco no Brasil e soberania

O escopo inicial é o Brasil. Nada impede a expansão depois, mas as decisões de produto priorizam o usuário brasileiro.

"Soberania", neste projeto, significa duas coisas:

1. **Independência de empresas estrangeiras:** nenhuma peça essencial (rede, distribuição, notificações) depende de uma Big Tech. Ao mesmo tempo, **ninguém no Brasil passa a ser dono da rede**: trocar a dependência de uma empresa estrangeira pela dependência de uma entidade nacional não é o objetivo.
2. **Infraestrutura no Brasil:** os servidores que guardam e repassam as mensagens podem ficar fisicamente no país, operados por brasileiros (pessoas, coletivos, comunidades).

**Parcerias:** parcerias com governo e instituições públicas não estão descartadas, por exemplo universidades ou órgãos públicos operando relays.

**Transição:** com orçamento zero, a v1 usa os servidores públicos globais que já existem, em sua maioria fora do Brasil. A meta é migrar gradualmente para uma rede de operadores voluntários brasileiros, no modelo do Mastodon/Fediverso.

## Público-alvo

Público geral no Brasil, com dois grupos prioritários:

| Grupo | Necessidade principal |
|---|---|
| **Pessoas comuns** (família, amigos, bairro, trabalho) | Facilidade igual à do WhatsApp, áudio, grupos, figurinhas, funcionar em celular simples |
| **Ativistas e jornalistas** | Possíveis apoiadores e divulgadores da ideia. Não necessariamente precisam de anonimato; o nível de proteção será discutido no modelo de ameaças |

Consequências:

- A experiência precisa ser comparável à do WhatsApp. Conceitos como "chave privada" e "relay" não podem ser pré-requisito para usar o app.
- Spam, abuso, recuperação de conta e confiabilidade na entrega são problemas do produto, não detalhes.

## Realidade brasileira: prioridades de produto

| Prioridade | O que significa |
|---|---|
| **Celulares simples e rede ruim** | Funcionar bem em Android de entrada, com pouca memória e com 3G/4G instável; tolerar ficar offline |
| **Franquia de dados** | Gastar o mínimo de dados possível: compressão de mídia, sem tráfego desnecessário em segundo plano. Muitos planos pré-pagos têm WhatsApp gratuito, e o app compete em desvantagem |
| **Modos de uso de banda** | Perfis escolhidos pelo usuário, como os modos de energia de um notebook (ex.: Econômico / Equilibrado / Qualidade), que controlam a qualidade da mídia enviada, o download automático e a sincronização em segundo plano |
| **Armazenamento inteligente** | Evitar o problema do WhatsApp, que enche a memória do celular com mídia. Ex.: mídia encaminhada salva uma única vez, download sob demanda, prévias leves, expiração automática de mídia antiga e um painel claro do que ocupa espaço |
| **Áudio e grupos** | Mensagens de voz e grupos (família, trabalho, condomínio) são o uso dominante e precisam ser excelentes desde cedo |
| **Figurinhas e expressão** | Figurinhas e stickers como recurso de primeira classe, incluindo um **tipo de mídia novo**: a *figurinha sonora*, uma imagem com um áudio curto embutido (ver Q6) |
| **Atenção e foco** | Frequência de sincronização e de notificações configurável, inclusive menos frequente de propósito (ex.: entrega em lotes a cada X minutos, horários de silêncio, resumo periódico). Ajuda a reduzir vício e dispersão e economiza bateria e dados |
| **Modo foco** | Parar de *exibir* mensagens sem desligar a internet do celular, por um período (manual, por tempo ou agendado). Duas variantes: **Reter**, em que o app continua recebendo mas guarda tudo internamente e só mostra quando o modo termina; e **Pausar**, em que o app nem sincroniza (economiza bateria e dados). Opcional: exceções para contatos escolhidos e aviso automático. *Tradeoff:* no Pausar, **mensagens podem se perder**. É aceito por design, para não sobrecarregar os relays com retenção longa; o status de entrega deve indicar a perda (ver abaixo); no Reter, não há esse risco, mas não há economia de recursos |
| **Status de entrega** | Indicadores no estilo dos checks do WhatsApp: enviada → entregue no aparelho → lida, mais um estado próprio para **"retida em modo foco"** (ex.: ícone de lua), para que quem enviou entenda a demora. Envio de confirmações configurável por privacidade. Inclui um estado de **"não entregue / possivelmente perdida"**, com opção de reenviar (ver Q10) |
| **Inclusão e acessibilidade** | Pessoas idosas, com baixa alfabetização digital ou com deficiência: textos simples, leitor de tela, fontes grandes e fluxos com poucos passos |

## Princípios (proposta, a confirmar)

Princípios derivados do objetivo "alternativa brasileira às Big Techs". Servem para desempatar decisões futuras.

1. **Sem dono central:** nenhuma peça do sistema pode ser desligada por uma única entidade, incluindo o próprio projeto.
2. **Soberania:** nenhuma dependência essencial de empresas estrangeiras; preferência por infraestrutura operada no Brasil.
3. **Custo zero para o projeto:** se uma funcionalidade exige um servidor pago, ela não entra ou é redesenhada.
4. **Identidade do usuário, não da plataforma:** sem número de telefone ou e-mail obrigatório. A identidade é um par de chaves que o usuário controla e pode levar para outro app.
5. **Código aberto:** necessário para que a independência possa ser verificada e para que outros possam continuar o projeto.
6. **Protocolo aberto e interoperável** (preferência): usar um protocolo que outros apps também falam, para evitar criar um novo "jardim murado".
7. **Mínimo de dados:** o app não coleta telemetria nem dados pessoais.
8. **Leve e inclusivo:** toda funcionalidade precisa funcionar num celular simples, com rede ruim, e ser usável por quem tem pouca familiaridade com tecnologia.
9. **Respeito à atenção:** o app não é desenhado para viciar. O usuário controla quando e com que frequência recebe mensagens e notificações. Nada de mecânicas de engajamento compulsivo.
10. **Android primeiro:** o Android é a plataforma prioritária, por ser mais aberto e por ser o celular da maioria dos brasileiros. O iOS é suportado com as limitações que a Apple impõe.

## Diferencial em relação às alternativas

| App | O que já resolve | Por que não basta |
|---|---|---|
| WhatsApp / Messenger | UX, base de usuários | Pertencem a uma Big Tech estrangeira, exigem telefone e coletam metadados |
| Telegram | UX, recursos | Centralizado; a criptografia ponta a ponta não é padrão |
| Signal | Criptografia de referência | Centralizado (um servidor, uma organização estrangeira) e exige telefone |
| Session | Descentralização, sem telefone, código aberto | A rede depende de um token de criptomoeda (staking); ID de 66 caracteres hexadecimais, pouco amigável; sem forward secrecy; não interopera com outros apps |
| SimpleX | Descentralização, privacidade de metadados de referência | Sem ID de usuário (contato só por link/QR), conceito difícil para leigos; servidores padrão operados pela própria empresa e um parceiro; não interopera com outros apps |

**Diferencial deste projeto (proposta):** nenhum dos apps acima é pensado para o Brasil. O diferencial é a combinação de três coisas:

- descentralização com operadores brasileiros;
- UX para o público leigo brasileiro: áudio, grupos, figurinhas, celular simples, pouco dado;
- proteção suficiente para ativistas e jornalistas.

## Plataformas

- **MVP:** Web/PWA (instalável, sem custo de lojas). Sem notificações em segundo plano: ao voltar para a aba ou abrir o app, ele reconecta aos relays e busca tudo o que chegou desde a última sincronização.
- **Prioridade seguinte:** Android nativo (plataforma principal, ver princípio 10) e desktop nativo (Windows, macOS, Linux), ambos reaproveitando o código web (ex.: Capacitor no Android, Tauri no desktop).
- **Futuro:** iOS.

No desktop nativo, notificações não são problema: o sistema não mata o app em segundo plano, então ele pode manter a própria conexão com os relays (ícone na bandeja), sem depender de serviço de push de terceiros.

**Notificações soberanas:** no Android nativo, as notificações usam **UnifiedPush**, com distribuidores (ex.: ntfy) operados pela mesma comunidade brasileira que roda os relays, sem passar pelo Google. Alternativa sempre disponível: sincronização periódica sem push. No iOS isso é impossível, porque a Apple obriga o uso do APNs; lá, a alternativa futura é o push sem conteúdo, que só diz "acorde".

## Não-objetivos (por enquanto)

- Ser uma rede social (feed, perfis públicos, seguidores).
- Monetização, anúncios ou token/cripto próprio.
- Operar servidores do projeto.
- Paridade total de recursos com o WhatsApp na v1 (status, comunidades, pagamentos).

## Métricas de sucesso (proposta)

- Um usuário leigo consegue instalar, criar a identidade e mandar a primeira mensagem em menos de 2 minutos, sem ajuda.
- 99% das mensagens são entregues quando o destinatário abre o app em até 7 dias.
- O custo mensal de infraestrutura para o projeto é zero.
- O app funciona de forma aceitável num Android de entrada com 2 GB de RAM, em 3G.
- Existem relays mantidos por pelo menos N operadores brasileiros independentes (N a definir).

## Questões em aberto

| # | Questão | Responsável |
|---|---|---|
| Q1 | Confirmar ou ajustar a lista de princípios acima | ✅ Princípios confirmados na aprovação da Visão |
| Q2 | Validar a proposta de diferencial (Brasil + operadores nacionais + UX leiga + proteção para ativistas) | ✅ Diferencial confirmado na aprovação da Visão |
| Q3 | **Conflito:** iOS e Android nativos no futuro custam US$ 99/ano (Apple) e US$ 25 (Google), mas o orçamento é zero absoluto. Opções: aceitar esse custo quando chegar a hora, aceitar doações, distribuir no Android só via F-Droid/APK e manter o iOS só como PWA | ➡️ Encaminhada em [04](04-requisitos-nao-funcionais.md) (Q-N2 Google Play, Q-N5 macOS) |
| Q4 | O app terá nome? Um nome brasileiro ajuda na identidade do projeto | Pedro |
| Q5 | Qual nível de proteção o app oferece (sigilo do conteúdo, de quem fala com quem, anonimato)? Ativistas e jornalistas entram como apoiadores, não necessariamente como usuários que exigem anonimato | ✅ Resolvida em [02](02-modelo-de-ameacas.md#decisões-tomadas-nesta-etapa) |
| Q6 | Detalhar a *figurinha sonora*: duração máxima do áudio, formato, como é criada e como aparece em apps que não a reconhecem | ➡️ Encaminhada em [03](03-requisitos-funcionais.md) (Q-F5) e [06](06-protocolo-e-dados.md) (Q-P2), para a v1 |
| Q7 | **Notificações no Android:** confirmar a direção Capacitor + UnifiedPush (distribuidores operados pela comunidade brasileira). Avaliar se dá para embutir o distribuidor no próprio app, para o usuário não precisar instalar o ntfy à parte, e se o "acorde" pode ser enviado pelo app do remetente, sem servidor vigiando os relays | ✅ Direção definida no [ADR-0005](adr/0005-notificacoes.md); quem dispara o push fica para o início da v1 ([07](07-roadmap.md)) |
| Q8 | Como atrair e organizar operadores voluntários de relays no Brasil (documentação, comunidade, parcerias)? | Pedro |
| Q9 | Confirmações de entrega/leitura e o estado "em modo foco" revelam quando a pessoa está ativa. Devem ser ligadas ou desligadas por padrão? Mostrar o modo foco é opt-in? | ✅ Resolvida em [02](02-modelo-de-ameacas.md#decisões-tomadas-nesta-etapa) |
| Q10 | Como detectar a perda de uma mensagem? Ideias: o remetente marca como "possivelmente perdida" quando não há confirmação de entrega após N dias; ou cada conversa tem uma numeração sequencial, o destinatário detecta buracos ("falta a mensagem 5") e pede reenvio ao remetente, que guarda a cópia local | ✅ Resolvida em [06](06-protocolo-e-dados.md#35-detecção-de-perdas-q10-da-visão): as duas ideias |
