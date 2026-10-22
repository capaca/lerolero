# Rascunhos dos testes de ponta a ponta

Scripts Puppeteer escritos durante o M1 e o M2 para testar o app num Chrome de verdade.
São **referência para a suíte e2e** (`packages/e2e`, Playwright): migre um rascunho para lá e apague-o daqui. Não
rodam como estão (caminhos de uma pasta temporária, Chrome do macOS, relays reais).

| Script | O que cobre |
|---|---|
| `identidade.mjs` | cadastro, PIN errado, bloquear, esqueci o PIN, ver a frase, restaurar, lembrete, limite de tentativas |
| `contatos.mjs` | convite (link e QR com câmera simulada, leitor nativo e jsQR), nome local, convite pendente |
| `conversa.mjs` | conversa entre duas pessoas pela rede real, não lidas, pedido de contato |
| `update.mjs`, `upgrade.mjs`, `branca.mjs`, `laco.mjs` | atualização do app, service worker, tela branca e autocorreção |
| `gestao.mjs` | gestão do grupo com 4 pessoas: detalhes, renomear, adicionar, promover, remover, sair e herança do título |
| `pin.mjs` | PIN em bolinhas: pular para a confirmação, PINs diferentes, PIN errado, ver a frase |
| `data.mjs` | data do dia no topo ao rolar: aparece, troca de dia, some ao parar e no fim, rolagem longa |
| `novas.mjs` | linha "Mensagens novas" ao abrir e ao chegar, botão de ir para o fim com contagem (duas pessoas, relays reais); regressão da ordem com a fila de envio |
| `copiar-mensagem.mjs` | "Copiar" no menu da mensagem (botão direito e toque longo), aviso "Mensagem copiada", vibração |
| `comentario.mjs`, `rede.mjs`, `copiar.mjs` | enviar comentário, kind 10050 na rede, copiar a frase |
| `pages-server.mjs` | servidor estático que imita o GitHub Pages (404.html, `.html`, cache opcional) |
