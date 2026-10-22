# Rascunhos dos testes de ponta a ponta

Scripts Puppeteer escritos durante o M1 e o M2 para testar o app num Chrome de verdade.
São **referência para a suíte e2e** (`packages/e2e`, Playwright): migre um rascunho para lá e apague-o daqui. Não
rodam como estão (caminhos de uma pasta temporária, Chrome do macOS, relays reais).

| Script | O que cobre |
|---|---|
| `identidade.mjs` | cadastro, PIN errado, bloquear, esqueci o PIN, ver a frase, restaurar, lembrete, limite de tentativas |
| `conversa.mjs` | conversa entre duas pessoas pela rede real, não lidas, pedido de contato |
| `upgrade.mjs`, `branca.mjs` | publicação nova por cima de um app antigo com o cache do Pages (precisam de dois builds; o aviso de versão nova e a autocorreção já estão na suíte) |
| `pin.mjs` | PIN em bolinhas: pular para a confirmação, PINs diferentes, PIN errado, ver a frase |
| `rede.mjs`, `copiar.mjs` | kind 10050 na rede, copiar a frase |
| `pages-server.mjs` | servidor estático que imita o GitHub Pages (404.html, `.html`, cache opcional) |
