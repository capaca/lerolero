# 06 — Protocolo e dados

- **Status:** ✅ aprovado
- **Última atualização:** 2026-10-16

Formatos concretos das mensagens na rede e dos dados guardados no aparelho. Base: [ADR-0001](adr/0001-protocolo-de-transporte.md) (Nostr), [ADR-0003](adr/0003-armazenamento-local.md) (IndexedDB) e [ADR-0004](adr/0004-midia.md) (mídia).

## 1. Princípios do protocolo

1. **Padrão primeiro:** usar NIPs existentes sempre que houver um, para manter a interoperabilidade com outros apps Nostr.
2. **Extensões compatíveis:** recursos próprios entram como **tags extras** (que outros apps ignoram) ou como **kinds próprios** com tag `alt` (NIP-31), que traz um texto legível para apps que não os entendem.
3. **Tudo embrulhado:** todo evento entre usuários (mensagens, reações, confirmações, controle de grupo) trafega dentro de um gift wrap (NIP-59). Nada de conversa privada é publicado em claro.
4. **Versionado:** eventos próprios levam a tag `["v", "1"]`; versões futuras devem continuar lendo versões anteriores (RNF-93).

## 2. Identidade e chaves

| Item | Especificação |
|---|---|
| Par de chaves | secp256k1 (padrão Nostr) |
| Frase de recuperação | BIP-39, 12 palavras **sorteadas pelo app** (nunca escolhidas pela pessoa: frases inventadas são previsíveis e podem ser quebradas em massa, sem precisar do aparelho; decidido em 2026-10-22), **lista oficial em português**. O app orienta guardar num papel em lugar seguro ou num gerenciador de senhas, e oferece copiar com aviso sobre o histórico do teclado e a nuvem, limpando a cópia após 1 minuto. Atenção: no BIP-39 a chave é derivada das próprias palavras, então a mesma frase em outra língua gera **outra chave**. Para usar a identidade em outro app Nostr, o caminho é exportar a chave privada (opção avançada) |
| Derivação | NIP-06: caminho `m/44'/1237'/0'/0/0` |
| Proteção no PWA | Chave privada cifrada com AES-GCM; a chave de cifra vem do **PIN** via **Argon2id** (parâmetros mínimos recomendados pela OWASP: 19 MiB de memória, 2 iterações, paralelismo 1; ajustar para ~1 s no aparelho de referência) |
| Proteção no nativo | Cofre do sistema (Android Keystore, Keychain etc.); PIN opcional |
| PIN | **6 dígitos** (decidido em 2026-10-22). Familiar para o público leigo; a força vem do Argon2id calibrado e do limite de tentativas ([T14 e T15](02-modelo-de-ameacas.md)). Esquecer o PIN: digitar a frase cria um PIN novo no mesmo aparelho, sem perder as conversas. A frase pode ser vista de novo nos ajustes, pedindo o PIN |
| Nome de exibição | **Privado** (decidido em 2026-10-22): **não** publicamos perfil (kind `0`). O nome vai só dentro do convite/QR e das mensagens cifradas, então só os contatos ligam a chave a um nome. Outros apps Nostr mostram apenas a chave |
| Convite (QR e link) | Leva a chave pública, o nome e os relays de DM, para quem recebe poder escrever sem consultar a rede. Formato: `<endereço do PWA>/convite#<nprofile>&n=<nome>`, em que o `nprofile` (NIP-19, chave + até 3 relays `wss://`) é entendido por outros apps Nostr e o nome vai à parte. Os dados ficam depois do `#`, que não chega ao servidor. O QR contém o próprio link, então a câmera comum do celular também abre o app. Ao adicionar, a pessoa escolhe o nome local (RF-14), com o nome do convite só como sugestão Até a Q-N1 (domínio), o endereço é o do GitHub Pages: **links criados antes do domínio deixam de funcionar quando ele mudar**, então a Q-N1 precisa estar decidida antes do beta |
| Relays de DM | Publicados em um evento kind `10050` com 1 a 3 relays (recomendação do NIP-17) |

## 3. Mensagens na rede

### 3.1 Envelope (NIP-17 / NIP-59)

```
kind 1059  Gift wrap — assinado por chave descartável; tag ["p", <destinatário>]
 └─ kind 13  Selo — assinado pelo remetente real; conteúdo cifrado (NIP-44)
     └─ rumor (evento sem assinatura) — o conteúdo de fato
```

- O remetente cria **um gift wrap por destinatário**, mais **um para si mesmo** (para ter a própria cópia em outros aparelhos e no backup).
- `created_at` do gift wrap e do selo é embaralhado em até 2 dias para trás (NIP-59). O horário real fica só no rumor.
- NIP-44 v2 já faz o padding do conteúdo (T2, RNF-43).

### 3.2 Tipos de rumor

| Uso | Kind | Padrão | Observações |
|---|---|---|---|
| Mensagem de texto | `14` | NIP-17 | Resposta: tag `["e", <id do rumor citado>]`. Tags próprias: `seq`, `g` (ver abaixo) |
| Mídia (foto, áudio) | `15` | NIP-17 | Tags do NIP-17 para arquivos: `file-type`, `encryption-algorithm` (`aes-gcm`), `decryption-key`, `decryption-nonce`, `x` (hash do arquivo cifrado), `ox` (hash do original), `size`, `dim`, `blurhash`/`thumb` (prévia), URLs do Blossom |
| Reação | `7` | NIP-25 | Tag `["e", <id do rumor>]`; conteúdo = emoji |
| Apagar para todos | `5` | NIP-09 | Pedido de apagamento; outros apps podem ignorar (RF-25) |
| Edição | próprio | — | Kind a definir; tag `["e", <id original>]` + novo texto + `alt` |
| Confirmação (entregue / lida / retida) | próprio | — | Kind a definir (seção 3.4) |
| Controle de grupo | próprio | — | Kind a definir (seção 3.3) |
| Pedido de reenvio | próprio | — | Kind a definir (seção 3.5) |

Os números dos kinds próprios devem ser escolhidos consultando o registro de kinds do repositório de NIPs, para evitar colisão (Q-P1).

### 3.3 Grupos

O NIP-17 define uma conversa pelo **conjunto de participantes** (tags `p`), com nome opcional pela tag `subject`. Isso não basta para RF-31 (adicionar/remover membros, administrador), então usamos uma convenção por cima:

- Cada grupo tem um **identificador aleatório** na tag `["g", <id>]`, presente em todo rumor do grupo. Assim o grupo mantém a identidade quando os membros mudam.
- **Eventos de controle** (kind próprio) com ações `criar`, `adicionar`, `remover`, `renomear`, `promover`. Só são aceitos se assinados (no selo) por um administrador conhecido.
- Cada membro guarda a lista atual de membros; mensagens são embrulhadas só para ela. Membro removido simplesmente deixa de receber embrulhos (RF-32).
- Limite: **20 membros** (RF-30).
- Apps que não entendem a tag `g` veem uma conversa NIP-17 comum entre os mesmos participantes.

### 3.4 Status de entrega

| Status | Quem gera | Quando |
|---|---|---|
| Pendente | Remetente (local) | Mensagem salva, ainda não publicada |
| Enviada | Remetente (local) | Ao menos um relay confirmou (`OK`) |
| Entregue | Destinatário | Ao decifrar a mensagem, publica confirmação `entregue` |
| Retida em modo foco | Destinatário | Em vez de `entregue`, se ele permitir mostrar o estado (RF-52) |
| Lida | Destinatário | Ao exibir a mensagem, se a confirmação de leitura estiver ligada (RF-51) |
| Possivelmente perdida | Remetente (local) | Sem confirmação em 7 dias, ou pedido de reenvio recebido (seção 3.5) |

Confirmações são **agrupadas**: um único evento pode confirmar várias mensagens de uma vez (lista de tags `e`), para economizar dados. Quem desliga a confirmação de leitura também não processa as dos outros.

### 3.5 Detecção de perdas (Q10 da Visão)

Usamos as duas ideias:

1. **Numeração por conversa:** cada remetente numera suas mensagens em cada conversa com a tag `["seq", "<n>"]`. O destinatário que recebe `n` e `n+2` sabe que falta `n+1`. Como os horários são embaralhados e os relays podem entregar fora de ordem, ele espera uma janela (ex.: até a próxima sincronização completa) antes de concluir que houve perda. Então envia um **pedido de reenvio** com os números faltantes, e o remetente reenvia a partir da cópia local.
2. **Prazo do remetente:** sem confirmação em 7 dias, a mensagem vira "possivelmente perdida", com botão para reenviar. Só funciona se o destinatário enviar confirmações.

A numeração funciona mesmo com confirmações desligadas e detecta perdas no modo Pausar.

### 3.6 Mídia (Blossom)

1. Comprimir (foto: lado maior 1600 px, ≤ 200 KB; áudio: Opus ~16 kbps).
2. Calcular `ox` = SHA-256 do arquivo comprimido original.
3. Gerar chave e nonce aleatórios; cifrar com AES-GCM; calcular `x` = SHA-256 do arquivo cifrado.
4. Enviar para **2 servidores Blossom** (autorização Blossom assinada pelo usuário).
5. Publicar rumor kind `15` com URLs, chave, nonce, `x`, `ox`, tamanho, dimensões e prévia (≤ 5 KB).

**Deduplicação:** o cache local é indexado por `ox`. **Encaminhar** reutiliza URL, chave e `x` já existentes: nenhum envio novo.

### 3.7 Backup cifrado (RF-06)

- Evento kind `30078` (NIP-78, dados de aplicativo) com tag `["d", "<app>/backup"]`, conteúdo cifrado com NIP-44 **para a própria chave**.
- Contém: contatos (chave, nome local, estado), grupos (id, membros, administradores, nome), configurações (modo foco, confirmações, expiração de mídia, relays).
- **Não contém** mensagens nem mídia.
- Publicado nos relays do usuário, atualizado quando contatos, grupos ou configurações mudam (com intervalo mínimo, para economizar dados).

### 3.8 Antispam (RF-90)

- A **primeira mensagem** para quem não é contato leva prova de trabalho (NIP-13) no gift wrap, com dificuldade calibrada para < 1 s no aparelho de referência (RNF-18).
- O destinatário descarta, sem decifrar, mensagens de não contatos sem a dificuldade mínima, e manda as demais para "Pedidos de mensagem" (RF-12).

### 3.9 Sincronização

- **Assinatura:** `{"kinds": [1059], "#p": [<minha chave>], "since": <cursor − 2 dias>}` em cada relay de DM, com autenticação NIP-42 quando o relay exigir.
- **Cursor por relay:** maior `created_at` processado; a margem de 2 dias compensa o embaralhamento de horário.
- **Deduplicação:** guardar os ids de gift wraps processados por 9 dias (7 de retenção + 2 de margem) e descartar repetidos.
- **Fila de envio:** eventos prontos ficam na fila até ao menos um relay confirmar; novas tentativas com espera crescente (RNF-33).

## 4. Dados no aparelho (IndexedDB)

Esquema inicial (Dexie). `PK` = chave primária, `idx` = índice.

| Tabela | Campos principais | Índices |
|---|---|---|
| `identity` | chave pública, chave privada cifrada, sal e parâmetros do Argon2id, frase confirmada (sim/não) | — |
| `settings` | chave/valor (modo foco, confirmações, expiração de mídia, entrega em lotes…) | PK: chave |
| `contacts` | chave pública, nome local, nome escolhido pelo contato, foto, estado (`aceito`, `pedido`, `bloqueado`), relays de DM | PK: chave pública; idx: estado |
| `conversations` | id, tipo (`direta`, `grupo`), membros, administradores, nome, última mensagem, não lidas, exceção de modo foco, último `seq` enviado | PK: id; idx: última mensagem |
| `messages` | id do rumor, conversa, remetente, kind, texto, horário real, `seq`, status, resposta a, editada em, apagada, retida (modo foco), hash da mídia (`ox`) | PK: id; idx: [conversa + horário], status, retida |
| `reactions` | mensagem, autor, emoji | idx: mensagem |
| `media` | `ox` (hash original), tipo, tamanho, arquivo (Blob), URLs Blossom, chave, nonce, `x`, guardar (sim/não), último acesso | PK: `ox`; idx: último acesso |
| `outbox` | eventos prontos, relays de destino, tentativas, próxima tentativa | idx: próxima tentativa |
| `sync` | relay, cursor | PK: relay |
| `seen_wraps` | id do gift wrap, recebido em | PK: id; idx: recebido em (limpeza após 9 dias) |
| `relays` | URL, papel (`dm`, `geral`, `blossom`), origem (`padrão`, `usuário`) | PK: URL |

**Expiração de mídia (RF-72):** tarefa local apaga de `media` os Blobs com último acesso há mais de 30 dias e `guardar = não`. A mensagem e a prévia continuam.

**Migrações:** cada mudança de esquema ganha uma nova versão no Dexie, com função de migração testada.

## 5. Compatibilidade com outros apps Nostr

| Recurso | Outro app Nostr vê |
|---|---|
| Texto, resposta, foto, áudio, reação | Normal (padrões NIP-17/25) |
| Grupo (tag `g`) | Conversa comum entre os mesmos participantes |
| Edição, confirmações, controle de grupo, pedido de reenvio | Ignorados, ou o texto da tag `alt` |
| Numeração (`seq`) | Ignorada |

## Questões em aberto

| # | Questão | Responsável |
|---|---|---|
| Q-P1 | Escolher os números dos kinds próprios (edição, confirmação, controle de grupo, pedido de reenvio) no registro de NIPs; avaliar propor um NIP para confirmações de entrega, que hoje não têm padrão | Implementação |
| Q-P2 | Formato da figurinha sonora (v1): provavelmente kind `15` com imagem + áudio Opus curto, e `alt` "figurinha sonora" para outros apps (Q-F5) | Pedro (v1) |
| Q-P3 | Janela de espera antes de pedir reenvio por buraco na numeração | Implementação |
| Q-P4 | ✅ Português. Interoperabilidade da identidade via exportação da chave privada | — |
