# 04 — Requisitos não funcionais

- **Status:** ✅ aprovado
- **Última atualização:** 2026-11-11

Metas de qualidade que valem para todo o app. Os números de desempenho foram medidos no aparelho de referência em 2026-11-11 (Q-N4); cada meta traz o resultado.

## 1. Aparelho de referência e plataformas

**Aparelho de referência:** **Xiaomi Redmi Note 8** (2019, Snapdragon 665, 4 GB de RAM, Android 10, Chrome e WebView 156). Todas as metas de desempenho são medidas nele, pelo protótipo de medição ([prototipos/medicao](../prototipos/medicao/README.md)) e pelo app de verdade (`packages/e2e/medir-celular.ts`). Escolhido pelo Pedro em 2026-11-11, no lugar do "Android 8+ com 2 GB" do início: foi o celular mais simples que ele conseguiu, e os resultados bastam para um aparelho de entrada. Rejeitado esperar um aparelho de 2 GB. A pressão de memória de um 2 GB fica sem medição.

| ID | Requisito | Fase |
|---|---|---|
| RNF-01 | PWA funciona nas duas últimas versões estáveis de Chrome, Firefox, Edge e Safari, no celular e no computador | MVP |
| RNF-02 | App Android nativo: Android 8.0 (API 26) ou superior | v1 |
| RNF-03 | App desktop nativo: Windows 10+, macOS 12+, Linux (Ubuntu 22.04+ ou equivalente) | v1 |
| RNF-04 | O mesmo código web é reaproveitado no PWA, no Android (Capacitor) e no desktop (Tauri) | MVP → v1 |

## 2. Desempenho

| ID | Requisito | Meta |
|---|---|---|
| RNF-10 | Abrir o app (já instalado, partida a frio) até a lista de conversas | < 3 s. ❌ Medido 3,9 a 5,0 s no Chrome (limite superior), dos quais ~1,8 s são o Chrome abrindo e ~1,2 s a página carregando. Rever no app nativo (item 27) |
| RNF-11 | Abrir uma conversa com histórico | < 500 ms. ✅ 187 ms com 50 mensagens; 247 ms (pior 316 ms) com 2.000 |
| RNF-12 | Mensagem enviada aparece na tela de quem envia | < 100 ms (antes mesmo de chegar ao relay). ❌ 107 ms com 50 mensagens; 158 ms (pior 219 ms) com 2.000; 119 ms (pior 150 ms) com 2.000 depois do item 28a. Item 28 |
| RNF-13 | Entrega com os dois usuários online | < 2 s em 95% dos casos. Ida e volta de um gift wrap pelo celular: 0,3 s (auth.nostr1.com) e 2,0 s (relay.primal.net); depende mais dos relays que do aparelho. Com 2.000 mensagens seguidas e a conversa aberta, o celular recebeu ~3,6 por segundo (item 28) |
| RNF-14 | Rolagem de conversa longa sem travar | 60 fps, sem engasgos perceptíveis. ❌ 60 fps com 50 mensagens; 31 a 36 fps, com 3 a 6 engasgos, com 2.000 e as anteriores carregadas; 55 a 57 fps, com 2 a 4 engasgos, depois do item 28a. No protótipo, os blocos com `content-visibility` rolam 2.000 a 60 fps. Item 28 |
| RNF-15 | Memória usada pelo app | < 150 MB. ⚠️ Heap JS de 53 MB com 50 mensagens e 114 MB depois das 2.000 (o processo da aba no Chrome, 341 MB) |
| RNF-16 | Tamanho do download inicial do PWA (código) | < 500 KB comprimido |
| RNF-17 | Tamanho do APK | < 15 MB |
| RNF-18 | Prova de trabalho antispam (RF-90) | < 1 s **em média** no aparelho de referência; o pior caso passa disso, porque a prova é sorte. 14 bits: média de 196 ms no Motorola Edge 60 (2026-10-29); no Redmi Note 8, média de 434 a 602 ms e a mais lenta de 0,9 a 2,6 s (3 rodadas de 10, 2026-11-11). Mantidos os 14 bits; rejeitado cair para 13 |

## 3. Consumo de dados e bateria

| ID | Requisito | Meta |
|---|---|---|
| RNF-20 | Sincronizar ao abrir o app sem mensagens novas | < 50 KB |
| RNF-21 | Peso extra por mensagem de texto (criptografia, envelope, padding), por destinatário | < 2 KB. ✅ 1,8 KB (gift wrap de 1.873 bytes), medido em 2026-11-11 |
| RNF-22 | Áudio em codec de voz eficiente (Opus ~28 kbps, que ainda soa bem em lugar barulhento) | ~210 KB por minuto |
| RNF-23 | Foto comprimida antes do envio (ex.: lado maior 1600 px) | ≤ 200 KB |
| RNF-24 | Prévia leve de imagem | ≤ 5 KB |
| RNF-25 | PWA não gera tráfego com o app fechado | 0 |
| RNF-26 | App nativo: nenhum tráfego periódico em segundo plano além do push (UnifiedPush) ou da sincronização periódica escolhida pelo usuário | — |
| RNF-27 | Mídia baixada uma única vez, mesmo se recebida em várias conversas (RF-70) | — |

## 4. Confiabilidade

| ID | Requisito | Meta |
|---|---|---|
| RNF-30 | Cada mensagem é publicada em vários relays independentes | 3 a 5 relays |
| RNF-31 | Tempo que uma mensagem espera o destinatário offline | **7 dias** (critério para escolher relays) |
| RNF-32 | Mensagens entregues quando o destinatário abre o app dentro de 7 dias | ≥ 99% |
| RNF-33 | **Offline primeiro:** é possível escrever e "enviar" sem conexão; o app guarda numa fila e envia quando a conexão volta | — |
| RNF-34 | Mensagens repetidas (vindas de vários relays) aparecem uma única vez | — |
| RNF-35 | O app continua funcionando se qualquer relay individual cair | — |
| RNF-36 | Lista de relays padrão atualizável sem nova versão do app; usuário avançado pode editar a sua | — |

## 5. Segurança

| ID | Requisito |
|---|---|
| RNF-40 | Criptografia ponta a ponta em todo conteúdo e mídia ([02](02-modelo-de-ameacas.md)) |
| RNF-41 | Conexões sempre cifradas (WSS/HTTPS); conexões sem TLS são recusadas |
| RNF-42 | A chave privada nunca sai do aparelho em claro. No nativo, protegida pelo cofre do sistema (Android Keystore, Keychain etc.) |
| RNF-43 | Padding das mensagens para tamanhos padronizados (T2) |
| RNF-44 | Usar apenas bibliotecas de criptografia conhecidas e auditadas; nada de criptografia própria |
| RNF-45 | PWA com Content Security Policy restritiva; nenhum script de terceiros |
| RNF-46 | Builds reproduzíveis para o APK (qualquer pessoa pode verificar que o APK corresponde ao código publicado) — meta para v1 |
| RNF-47 | Sem Tor/proxy embutido. Quem quiser esconder o IP usa uma VPN ou o Orbot no sistema (resolve a Q-A5) |

## 6. Privacidade e LGPD

**Diretrizes técnicas (agora):**

| ID | Requisito |
|---|---|
| RNF-50 | O projeto **não coleta dados pessoais**: sem analytics, rastreadores ou contas. A única coleta é o resumo técnico opcional da Q-N6 (aprovada em 2026-11-05): desligado por padrão, só contagens e tempos técnicos, nunca conteúdo, contatos, chaves ou nomes, enviado cifrado pela própria rede com chave descartável, e a pessoa vê o que é enviado |
| RNF-51 | Relatórios de erro só por ação explícita do usuário (ex.: exportar um log para enviar manualmente), revisável antes do envio |
| RNF-52 | Nenhum dado pessoal (telefone, e-mail, CPF) é pedido no fluxo padrão |
| RNF-53 | Os dados do usuário ficam no aparelho; nos relays, só dados cifrados e os metadados mínimos do protocolo |
| RNF-54 | Recomendação aos operadores de relays: guardar o mínimo possível e não manter logs de IP além do exigido por lei |

**Orientação jurídica (depois):** antes do lançamento público, buscar orientação sobre o Marco Civil (art. 15), ordens judiciais e LGPD, inclusive o papel do projeto (que distribui software, mas não opera servidores) e dos operadores de relays. Caminhos possíveis: clínicas de direito digital de universidades e organizações como Coding Rights e InternetLab (Q-N3).

## 7. Acessibilidade e inclusão

| ID | Requisito |
|---|---|
| RNF-60 | Conformidade com **WCAG 2.2 nível AA**, que também é a referência do e-MAG (padrão de acessibilidade do governo brasileiro) |
| RNF-61 | Funciona com leitor de tela (TalkBack no Android, NVDA/VoiceOver no desktop) |
| RNF-62 | Suporta fonte do sistema em 200% sem quebrar o layout |
| RNF-63 | Alvos de toque de pelo menos 48 dp. O e2e `textos` mede cada tela; ficam de fora o link no meio de uma frase e os atalhos de grupo do seletor de emojis, que não cabem numa linha e têm a rolagem da lista como caminho equivalente (WCAG 2.5.8; 2026-11-03) |
| RNF-64 | Linguagem simples em toda a interface; nada de jargão técnico (chave, relay, hash) no fluxo padrão. A chave pública e os servidores ficam em "Detalhes técnicos", fechado no fim dos Ajustes; o e2e `linguagem` barra o jargão nos textos (2026-11-02) |
| RNF-65 | Fluxos principais (cadastro, adicionar contato, enviar mensagem e áudio) testados com pessoas idosas ou com pouca familiaridade digital |

## 8. Idiomas

| ID | Requisito |
|---|---|
| RNF-70 | Interface em **português do Brasil** |
| RNF-71 | Todos os textos externalizados em arquivos de tradução, prontos para a comunidade traduzir para outros idiomas |
| RNF-72 | Datas, horas e números no formato da língua da interface (o brasileiro, em pt-BR; [ADR-0008](adr/0008-internacionalizacao.md)) |

## 9. Distribuição e custo

| ID | Requisito | Fase |
|---|---|---|
| RNF-80 | PWA hospedado em serviço gratuito (ex.: GitHub Pages ou Cloudflare Pages) | MVP |
| RNF-81 | Android distribuído como **APK direto** (ex.: GitHub Releases), assinado | v1 |
| RNF-82 | Android no **Google Play** | Depois da v1 (custo de US$ 25, ver Q3 da Visão) |
| RNF-83 | Desktop distribuído pelo GitHub Releases | v1 |
| RNF-84 | Custo de infraestrutura do projeto: **zero**, exceto o domínio próprio (~R$ 40/ano, Q-N1, 2026-11-05) | Sempre |

## 10. Código e manutenção

| ID | Requisito |
|---|---|
| RNF-90 | Licença **AGPL-3.0**: quem modificar e distribuir o app, ou oferecê-lo como serviço, precisa publicar o código |
| RNF-91 | Código público desde o início |
| RNF-92 | Testes automatizados para criptografia, protocolo e armazenamento local; integração contínua gratuita (ex.: GitHub Actions) |
| RNF-93 | Formato das mensagens versionado, para que versões diferentes do app convivam ([06](06-protocolo-e-dados.md)) |

## Decisões tomadas nesta etapa

- **Aparelho de referência:** ~~Android 8+, 2 GB de RAM~~; desde 2026-11-11, o Xiaomi Redmi Note 8 (4 GB, Android 10).
- **Retenção alvo:** 7 dias.
- **Licença:** AGPL-3.0.
- **Acessibilidade:** WCAG 2.2 AA.
- **Idioma:** pt-BR, com estrutura para tradução ([ADR-0008](adr/0008-internacionalizacao.md)).
- **Distribuição Android:** APK direto primeiro; Google Play depois.
- **Tor/proxy embutido:** não (Q-A5 resolvida).
- **Jurídico:** diretrizes técnicas agora; orientação jurídica antes do lançamento público (Q-A3 encaminhada).

## Questões em aberto

| # | Questão | Responsável |
|---|---|---|
| Q-N1 | **Domínio próprio:** um domínio `.br` custa ~R$ 40/ano, o que conflita com o orçamento zero. Sem ele, o PWA fica num endereço como `usuario.github.io/app`. O link de convite (RF-11) e a confiança do público leigo dependem disso. **Decidir antes do beta:** os convites criados até lá usam o endereço do GitHub Pages e quebram quando o domínio mudar. Também destrava a passkey (RF-08), adiada em 2026-10-29 para depois do beta; a decisão entra na revisão de prontidão | ✅ **Decidido em 2026-11-05: comprar um `.com.br` (~R$ 40/ano, registro.br) antes do beta**, apontado para o GitHub Pages, como única exceção ao RNF-84. Por quê: os dados no aparelho ficam presos à origem, então quem entrasse no beta pelo `github.io` perderia contas, conversas e convites na troca. Rejeitados: fazer o beta no `github.io` (todos restaurariam pelo código depois) e um subdomínio gratuito (eu.org, is-a.dev: depende de terceiros e parece menos confiável a leigos) | Pedro (antes do beta) |
| Q-N2 | ✅ Google Play custa US$ 25 uma vez: aceitar esse custo quando chegar a hora (Q3 da Visão)? **Decidido em 2026-11-06: no beta, APK assinado no GitHub Releases**, com aviso de versão nova no app e Obtainium opcional; a Play fica para depois do beta ([ADR-0011](adr/0011-app-android-nativo.md)). Rejeitados a Play já no beta e logo depois, dentro do item 27 | Pedro |
| Q-N3 | Buscar orientação jurídica antes do lançamento público (Marco Civil, ordens judiciais, LGPD) | Pedro (antes do lançamento) |
| Q-N4 | Validar as metas numéricas com medições reais no aparelho de referência, depois do primeiro protótipo | ✅ **Medido em 2026-11-11 no Redmi Note 8**, resultados na seção 2. O stack PWA + Svelte se sustenta ([ADR-0002](adr/0002-stack-do-cliente.md)); a conversa longa fica fora das metas e é corrigida no item 28; a partida a frio é revista no app nativo | Pedro + implementação |
| Q-N6 | **Dados técnicos de uso com consentimento** (proposta de 2026-10-22, para observabilidade): hoje o RNF-50 e o princípio 7 da Visão proíbem telemetria. Proposta compatível com o projeto: opt-in, desligado por padrão; um resumo diário só com contagens e tempos técnicos (falhas de entrega, tempo de entrega, relays com falha, erros por tipo), nunca conteúdo, contatos, chaves ou nomes; enviado pela própria rede como mensagem cifrada para uma conta do projeto, com chave descartável a cada envio; tela "ver o que é enviado". Limite: o relay vê o IP, como em qualquer uso. Decidir na revisão de prontidão para produção ([07](07-roadmap.md)); se aprovada, revisar RNF-50/51 e o princípio 7 | ✅ **Aprovada em 2026-11-05, opt-in automático, já no beta**: RNF-50 e o princípio 7 da Visão revistos. Rejeitados: só o diagnóstico enviado à mão (não mostra o que ninguém percebe, como o tempo de entrega dobrar) e nenhum dado | Pedro (antes do beta) |
| Q-N7 | **Servidor próprio de referência (do [estudo de escala](estudos/escala-whatsapp.md), 2026-10-28):** aceitar uma exceção ao RNF-84 (custo zero) para um relay e um Blossom de referência, de ~R$ 30/mês, já a partir do beta? Hoje só 7 de 100 relays de DM são aptos, nenhum no Brasil, e a lista padrão depende de 3 estrangeiros. Recomendação do estudo: sim, como entradas comuns da lista, sem tratamento especial no protocolo. Nada decidido | ✅ **Decidido em 2026-11-05: não no beta.** 20 pessoas cabem nos relays públicos da lista, e as sondas sintéticas da revisão de prontidão mostram se faltar capacidade. Reavaliar antes do lançamento público | Pedro (antes do lançamento público) |
| Q-N8 | Qual é o teto de usuários com que o projeto se compromete na v1 (ex.: 100 mil) antes de exigir um modelo de sustentação (doações, plano opcional, apoio institucional)? O estudo estima que em 1 milhão de usuários "custo zero" deixa de ser realista | Pedro |
| Q-N9 | Quem opera o TURN (e o push), se as chamadas entrarem? Hoje é o maior custo do Futuro: ~0,8 Gbps médio para 15 milhões de usuários no cenário baixo | Pedro (antes de decidir as chamadas) |
| Q-N5 | **macOS:** distribuir sem assinatura e notarização da Apple (US$ 99/ano) gera avisos de segurança ao instalar e pode bloquear notificações. Aceitar os avisos (com instruções de instalação) ou pagar quando chegar a hora? | Pedro (v1) |
