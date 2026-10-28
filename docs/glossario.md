# Glossário

| Termo | Significado |
|---|---|
| **ADR** | *Architecture Decision Record*: documento curto que registra uma decisão de arquitetura, as opções consideradas e as consequências ([adr/](adr/)) |
| **AGPL-3.0** | Licença de código aberto que obriga quem modifica e distribui o software, ou o oferece como serviço, a publicar o código |
| **APK** | Arquivo de instalação de apps Android |
| **APNs / FCM** | Serviços de notificação da Apple e do Google, respectivamente |
| **Argon2id** | Função propositalmente lenta que transforma o PIN numa chave de cifra, dificultando ataques de adivinhação |
| **BIP-39** | Padrão de frase de recuperação: uma lista de palavras (aqui, 12 em português) que representa a chave do usuário |
| **Blossom** | Padrão do ecossistema Nostr para guardar arquivos (mídia) em servidores HTTP, endereçados pelo hash |
| **Capacitor** | Ferramenta que empacota um app web como app Android nativo |
| **Criptografia ponta a ponta** | Só os participantes da conversa conseguem ler as mensagens; nenhum servidor intermediário consegue |
| **Dexie** | Biblioteca que facilita o uso do IndexedDB |
| **Forward secrecy** | Propriedade que mantém mensagens antigas protegidas mesmo se a chave atual vazar |
| **Gift wrap** | "Embrulho" do NIP-59: a mensagem cifrada vai dentro de um evento assinado por uma chave descartável, escondendo o remetente do relay |
| **Hash** | "Impressão digital" de um arquivo; arquivos iguais têm o mesmo hash. Usado para salvar a mesma mídia uma única vez |
| **IndexedDB** | Banco de dados embutido nos navegadores, onde o PWA guarda os dados no aparelho |
| **Kind** | Número que identifica o tipo de um evento Nostr (ex.: 14 = mensagem de chat, 1059 = gift wrap) |
| **Marmot** | Protocolo que traz o MLS para o Nostr; caminho futuro para forward secrecy |
| **Metadados** | Informações *sobre* a mensagem (quem recebe, quando, tamanho, IP), e não o conteúdo |
| **MLS** | *Messaging Layer Security*: padrão IETF de criptografia para grupos, com forward secrecy |
| **Modo foco (Reter / Pausar)** | Recurso que segura a exibição de mensagens por um período (Reter) ou interrompe a sincronização (Pausar) |
| **MoSCoW** | Método de priorização: *Must*, *Should*, *Could*, *Won't* |
| **MVP** | *Minimum Viable Product*: primeira versão com o mínimo necessário para validar a ideia (aqui, o PWA) |
| **NIP** | *Nostr Implementation Possibility*: cada especificação do protocolo Nostr (ex.: NIP-17, mensagens privadas) |
| **Nostr** | Protocolo aberto em que clientes publicam eventos assinados em relays independentes |
| **Padding** | Completar mensagens até tamanhos padronizados, para que o tamanho não revele o conteúdo |
| **Passkey** | Credencial guardada pelo sistema (Google/Apple) e liberada por biometria |
| **PRF (WebAuthn)** | Extensão da passkey que entrega um segredo de 256 bits ao app; serve de chave para cifrar o backup da identidade |
| **Código de recuperação** | Como a interface chama a frase de 12 palavras; pode ser guardada em arquivo, cartão impresso ou gerenciador de senhas ([ADR-0009](adr/0009-protecao-e-recuperacao-da-conta.md)) |
| **Prova de trabalho** | Pequeno cálculo obrigatório antes de enviar, que encarece o spam em massa (NIP-13) |
| **PWA** | *Progressive Web App*: site que pode ser instalado e funciona como app |
| **Relay** | Servidor Nostr que recebe, guarda temporariamente e repassa eventos |
| **Svelte** | Framework de interface que gera código pequeno e rápido |
| **Tauri** | Ferramenta que empacota um app web como app de desktop leve, com código nativo em Rust |
| **UnifiedPush** | Padrão aberto de notificações no Android, sem depender do Google; o usuário escolhe o distribuidor (ex.: ntfy) |
| **WCAG** | Diretrizes internacionais de acessibilidade para conteúdo web |
| **Web Worker** | Thread separada do navegador, usada para tarefas pesadas sem travar a interface |
| **WebSocket** | Conexão contínua entre o app e o relay, usada para enviar e receber eventos em tempo real |
