# Protótipo: a frase no gerenciador de senhas (item 14)

Mede, num aparelho de verdade, se o navegador oferece "Salvar senha?" para a frase de recuperação e se ela volta
inteira na restauração, na aba do navegador e no app instalado. O resultado decide se a camada D1 do
[ADR-0009](../../docs/adr/0009-protecao-e-recuperacao-da-conta.md) entra (Q-U2).

| Teste | O que faz |
|---|---|
| A | Formulário de nome + código, enviado por `fetch`; o formulário some, como num app sem troca de página |
| B | O mesmo formulário, indo para outra página depois do envio, como um login comum |
| C | `navigator.credentials.store(new PasswordCredential(...))`, que só o Chrome tem |
| Restaurar | Formulário com `current-password` (preenchimento automático) e `navigator.credentials.get` |

Cada variante usa um nome próprio na aba e no app instalado ("Lero teste A aba 1234", "Lero teste A app 5678"), para
dar para ver no gerenciador qual foi salva; os resultados das duas ficam juntos, cada um com o seu `modo`. As frases
são de teste, com palavras da lista em português, e não abrem conta nenhuma.

HTML e JavaScript puros, sem build: a homologação copia a pasta para `/lerolero/senha/`. Os ícones vêm do app
(`../icon-192.png`). Não é código do app e fica fora do monorepo.

## Como medir

1. Abra https://lerolero-app.github.io/lerolero/senha/ no Chrome do celular. Faça A, B e C, respondendo o que o
   navegador fez.
2. Em "Restaurar", toque no campo e veja se o navegador sugere uma conta "Lero teste"; teste também o botão do
   `credentials.get`.
3. Instale a página (menu → Instalar app). Ela tem nome e cor próprios ("Lero senha", roxo), separada do app da
   homologação. No app instalado, repita 1 e 2 (os resultados da aba continuam lá).
4. Para simular um aparelho novo, abra a restauração em outro navegador ou aparelho logado na mesma conta Google.
5. "Copiar resultados (JSON)" e cole no registro.
6. No fim, apague as contas "Lero teste" do Gerenciador de senhas do Google.

Para rodar no computador: `npx serve prototipos` e abra `/senha/` (os ícones não aparecem fora do site).
