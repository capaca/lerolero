# ADR-0009: Proteção e recuperação da conta em camadas (arquivo, gerenciador de senhas e passkey)

- **Status:** aceito
- **Data:** 2026-10-28

## Contexto

Hoje a identidade tem duas camadas ([06](../06-protocolo-e-dados.md)): a **frase de recuperação** (12 palavras BIP-39) é a
identidade, e o **PIN** de 6 dígitos (Argon2id) só cifra a chave no aparelho. A frase é pedida ao ganhar o primeiro
contato ([RF-03, RF-04](../03-requisitos-funcionais.md), T19), e a pessoa precisa **copiar e guardar sozinha**. Para o
público leigo esse é o ponto mais fraco do fluxo: quem não guarda perde a conta num dia ruim (T19, risco aceito), e
o pedido de copiar à mão é a parte que mais atrapalha. O Pedro quer um fluxo integrado em que a pessoa, se não quiser,
nem precise entender o que está acontecendo (conversa de 2026-10-28).

Além disso, o PIN de 6 dígitos no PWA tem um teto baixo: quem extrai os dados do navegador testa 1 milhão de PINs fora do
app (T15). A defesa real é uma chave que o ataque offline não alcance.

Restrição que define o desenho: um backup sem servidor central precisa de **um lugar que sobreviva à perda do celular** e de
**um segredo forte que o abra**. O PIN não serve como esse segredo: o backup ficaria em relays públicos e qualquer um
poderia baixá-lo (a chave pública é pública), e testar 1 milhão de PINs com Argon2id leva horas numa GPU. O segredo
precisa ter alta entropia e ficar num lugar que sincroniza sozinho e que a pessoa já protege.

## Opções consideradas

### Opção A — Só melhorar o lembrete da frase
- Prós: custo de dias, sem mudança de arquitetura.
- Contras: a pessoa continua copiando à mão; não resolve o T15.

### Opção B — PIN mais forte (alfanumérico ou passphrase), opcional
- Prós: fecha o T15 para quem quiser; barato.
- Contras: mais digitação; não resolve a perda da conta. **Fica como ideia futura**, não entra agora.

### Opção C — Passkey com a extensão PRF do WebAuthn
- Prós: digital ou rosto no lugar do PIN (RF-07); a chave de cifra vem do autenticador e tem 256 bits, então o backup
  cifrado pode ficar nos relays públicos sem risco de força bruta; num aparelho novo a passkey sincronizada recupera a
  conta sem digitar nada; fecha o T15 para quem a usar.
- Contras: a passkey fica presa ao domínio ([Q-N1](../04-requisitos-nao-funcionais.md)); o suporte a PRF é desigual e a
  passkey não atravessa do Android para o iPhone; a recuperação passa a depender da conta Google ou Apple da pessoa;
  custo de 2 a 3 semanas.

### Opção D1 — Frase salva no gerenciador de senhas do navegador/sistema
- Prós: é o mais perto de "nem precisar entender": o navegador oferece "Salvar senha?" num formulário de login de
  verdade (nome e frase) e sincroniza com a conta Google ou Apple, protegida pela biometria da pessoa; na restauração o
  campo se preenche sozinho. Custo de dias.
- Contras: o navegador controla o aviso e a pessoa pode recusar; **não dá para confirmar que salvou**; o comportamento
  em PWA instalado (principalmente no iPhone) precisa ser medido num aparelho real; a frase passa a existir num campo
  de formulário (risco pequeno, de extensão maliciosa).

### Opção D2 — Arquivo, nota ou cartão pelo menu de compartilhar do sistema
- Prós: funciona em qualquer plataforma e fora da nuvem (papel); sem dependências. Um arquivo autoexplicativo (o que é, que
  não deve ser enviado a ninguém, como restaurar, o link de restauração e as 12 palavras) que a pessoa entende ao
  reencontrá-lo daqui a um ano.
- Contras: o app não sabe para onde foi o arquivo, e a pessoa pode mandá-lo a outra pessoa sem querer; o link com a frase
  no fragmento (`#...`) quebra se o domínio mudar, por isso o arquivo traz também as palavras legíveis.

### Opção E — Custodiante via Pix ou gov.br (Q-A7)
- Prós: recuperação bem amigável.
- Contras: custodiante central, fim do anonimato, dado sensível na LGPD, custo de integração. **Segue adiada.**

## Decisão

**Camadas em volta de um segredo raiz único, a frase**, entregues na ordem D2, D1, C. Elas não competem, cada uma tem um
papel:

| Camada | Papel |
|---|---|
| D2, arquivo ou cartão | Recuperação explícita, entre plataformas e fora da nuvem |
| D1, gerenciador de senhas | Recuperação passiva, sem a pessoa fazer nada |
| C, passkey | Entrar no dia a dia sem o PIN e restaurar em aparelho novo sem digitar nada |

Regras do desenho:

1. **A frase continua sendo a base.** Nenhuma camada a substitui; todas são "embrulhos" dela. As palavras continuam
   visíveis nos ajustes, mas a interface passa a falar em **código de recuperação**.
2. **Uma camada concluída basta** para o lembrete do RF-04 parar. O estado aparece numa tela só, "Proteção da conta"
   (Protegida / Falta proteger), com os passos oferecidos na hora certa.
3. **Na restauração**, a ordem é do mais fácil para o mais seguro: passkey, preenchimento automático, arquivo, digitar
   as palavras. A tela de "Já tenho conta" mostra só o que o aparelho suporta.
4. **O arquivo (D2) fica em texto aberto**, sem cifrar com o PIN (escolha recomendada, a confirmar pelo Pedro ao
   implementar): ele já fica atrás da conta Google ou Apple da pessoa; cifrar com o PIN daria pouca proteção real
   contra quem já está dentro dessa conta (é o mesmo T15) e criaria o caso "esqueci o PIN e perdi o celular".
5. **Na C**, o backup cifrado com a chave da passkey (PRF) vai para os relays, e a identidade (npub) viaja junto com a
   passkey, para o aparelho novo saber qual backup buscar. A C só começa **depois da decisão do domínio (Q-N1)**.
6. **Passkey nunca no lugar da frase** (mantém a decisão de Q-A6).

Rejeitadas por enquanto: cifrar o backup dos relays com o PIN (inseguro, ver Contexto), Pix/gov.br (Q-A7) e recuperação
social (já descartada no [02](../02-modelo-de-ameacas.md)).

## Consequências

- **Mais fácil:** quem não quer entender nada toca num botão e fica protegido; o T19 (perda da conta antes de guardar a
  frase) cai bastante em frequência; a D2 já entrega valor em poucos dias, e cada passo é útil sozinho.
- **Mais difícil:** três caminhos de restauração para testar, com combinações de plataforma (a suíte e2e precisa cobri-los
  desde o começo; o Chrome tem autenticador virtual para a C); a frase passa a existir em mais lugares, cada um atrás
  de uma conta da própria pessoa, o que entra no modelo de ameaças.
- **Dívida assumida:** a C depende do domínio; se mudarmos de domínio, as passkeys precisam de migração (D1 e D2
  sobrevivem, por serem texto e arquivo).
- **Rever se:** o teste no aparelho real mostrar que o aviso de salvar senha não aparece no PWA instalado (a D1 perde
  sentido no Android ou no iPhone); o suporte a PRF melhorar de forma que a C possa vir antes; o Pedro decidir cifrar o
  arquivo com o PIN.
