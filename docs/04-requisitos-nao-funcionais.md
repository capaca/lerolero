# 04 — Requisitos não funcionais

- **Status:** ✅ aprovado
- **Última atualização:** 2026-10-16

Metas de qualidade que valem para todo o app. Os números são propostas iniciais, a serem validadas com medições reais no aparelho de referência.

## 1. Aparelho de referência e plataformas

**Aparelho de referência:** Android de entrada com **2 GB de RAM e Android 8 ou superior**. Todas as metas de desempenho são medidas nele.

| ID | Requisito | Fase |
|---|---|---|
| RNF-01 | PWA funciona nas duas últimas versões estáveis de Chrome, Firefox, Edge e Safari, no celular e no computador | MVP |
| RNF-02 | App Android nativo: Android 8.0 (API 26) ou superior | v1 |
| RNF-03 | App desktop nativo: Windows 10+, macOS 12+, Linux (Ubuntu 22.04+ ou equivalente) | v1 |
| RNF-04 | O mesmo código web é reaproveitado no PWA, no Android (Capacitor) e no desktop (Tauri) | MVP → v1 |

## 2. Desempenho

| ID | Requisito | Meta |
|---|---|---|
| RNF-10 | Abrir o app (já instalado, partida a frio) até a lista de conversas | < 3 s |
| RNF-11 | Abrir uma conversa com histórico | < 500 ms |
| RNF-12 | Mensagem enviada aparece na tela de quem envia | < 100 ms (antes mesmo de chegar ao relay) |
| RNF-13 | Entrega com os dois usuários online | < 2 s em 95% dos casos |
| RNF-14 | Rolagem de conversa longa sem travar | 60 fps, sem engasgos perceptíveis |
| RNF-15 | Memória usada pelo app | < 150 MB |
| RNF-16 | Tamanho do download inicial do PWA (código) | < 500 KB comprimido |
| RNF-17 | Tamanho do APK | < 15 MB |
| RNF-18 | Prova de trabalho antispam (RF-90) | < 1 s no aparelho de referência |

## 3. Consumo de dados e bateria

| ID | Requisito | Meta |
|---|---|---|
| RNF-20 | Sincronizar ao abrir o app sem mensagens novas | < 50 KB |
| RNF-21 | Peso extra por mensagem de texto (criptografia, envelope, padding), por destinatário | < 2 KB |
| RNF-22 | Áudio em codec de voz eficiente (ex.: Opus ~16 kbps) | ~120 KB por minuto |
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
| RNF-50 | O projeto **não coleta nenhum dado**: sem telemetria, analytics, rastreadores ou contas |
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
| RNF-63 | Alvos de toque de pelo menos 48 dp |
| RNF-64 | Linguagem simples em toda a interface; nada de jargão técnico (chave, relay, hash) no fluxo padrão |
| RNF-65 | Fluxos principais (cadastro, adicionar contato, enviar mensagem e áudio) testados com pessoas idosas ou com pouca familiaridade digital |

## 8. Idiomas

| ID | Requisito |
|---|---|
| RNF-70 | Interface em **português do Brasil** |
| RNF-71 | Todos os textos externalizados em arquivos de tradução, prontos para a comunidade traduzir para outros idiomas |
| RNF-72 | Datas, horas e números no formato brasileiro |

## 9. Distribuição e custo

| ID | Requisito | Fase |
|---|---|---|
| RNF-80 | PWA hospedado em serviço gratuito (ex.: GitHub Pages ou Cloudflare Pages) | MVP |
| RNF-81 | Android distribuído como **APK direto** (ex.: GitHub Releases), assinado | v1 |
| RNF-82 | Android no **Google Play** | Depois da v1 (custo de US$ 25, ver Q3 da Visão) |
| RNF-83 | Desktop distribuído pelo GitHub Releases | v1 |
| RNF-84 | Custo de infraestrutura do projeto: **zero** | Sempre |

## 10. Código e manutenção

| ID | Requisito |
|---|---|
| RNF-90 | Licença **AGPL-3.0**: quem modificar e distribuir o app, ou oferecê-lo como serviço, precisa publicar o código |
| RNF-91 | Código público desde o início |
| RNF-92 | Testes automatizados para criptografia, protocolo e armazenamento local; integração contínua gratuita (ex.: GitHub Actions) |
| RNF-93 | Formato das mensagens versionado, para que versões diferentes do app convivam ([06](06-protocolo-e-dados.md)) |

## Decisões tomadas nesta etapa

- **Aparelho de referência:** Android 8+, 2 GB de RAM.
- **Retenção alvo:** 7 dias.
- **Licença:** AGPL-3.0.
- **Acessibilidade:** WCAG 2.2 AA.
- **Idioma:** pt-BR, com estrutura para tradução.
- **Distribuição Android:** APK direto primeiro; Google Play depois.
- **Tor/proxy embutido:** não (Q-A5 resolvida).
- **Jurídico:** diretrizes técnicas agora; orientação jurídica antes do lançamento público (Q-A3 encaminhada).

## Questões em aberto

| # | Questão | Responsável |
|---|---|---|
| Q-N1 | **Domínio próprio:** um domínio `.br` custa ~R$ 40/ano, o que conflita com o orçamento zero. Sem ele, o PWA fica num endereço como `usuario.github.io/app`. O link de convite (RF-11) e a confiança do público leigo dependem disso. **Decidir antes do beta:** os convites criados até lá usam o endereço do GitHub Pages e quebram quando o domínio mudar | Pedro (antes do beta) |
| Q-N2 | Google Play custa US$ 25 uma vez: aceitar esse custo quando chegar a hora (Q3 da Visão)? | Pedro |
| Q-N3 | Buscar orientação jurídica antes do lançamento público (Marco Civil, ordens judiciais, LGPD) | Pedro (antes do lançamento) |
| Q-N4 | Validar as metas numéricas com medições reais no aparelho de referência, depois do primeiro protótipo | Pedro + implementação |
| Q-N5 | **macOS:** distribuir sem assinatura e notarização da Apple (US$ 99/ano) gera avisos de segurança ao instalar e pode bloquear notificações. Aceitar os avisos (com instruções de instalação) ou pagar quando chegar a hora? | Pedro (v1) |
