# Rascunhos dos testes de ponta a ponta

Scripts Puppeteer escritos durante o M1 e o M2 para testar o app num Chrome de verdade.
São **referência para a suite e2e** planejada (`packages/e2e` com Playwright, docs/07): não
rodam como estão (caminhos de uma pasta temporária, Chrome do macOS, relays reais).

| Script | O que cobre |
|---|---|
| `identidade.mjs` | cadastro, PIN errado, bloquear, esqueci o PIN, ver a frase, restaurar, lembrete, limite de tentativas |
| `contatos.mjs` | convite (link e QR com câmera simulada, leitor nativo e jsQR), nome local, convite pendente |
| `conversa.mjs` | conversa entre duas pessoas pela rede real, não lidas, pedido de contato |
| `audio.mjs`, `audio2.mjs` | gravar (microfone simulado), enviar, tocar, velocidade, um áudio por vez |
| `apagar.mjs` | apagar para mim e para todos, remoção no Blossom (branch `exclusao-de-mensagens`) |
| `update.mjs`, `upgrade.mjs`, `branca.mjs`, `laco.mjs` | atualização do app, service worker, tela branca e autocorreção |
| `gestao.mjs` | gestão do grupo com 4 pessoas: detalhes, renomear, adicionar, promover, remover, sair e herança do título |
| `teclado.mjs` | regressão: com o teclado aberto, as últimas mensagens continuam junto do campo |
| `comentario.mjs`, `rede.mjs`, `copiar.mjs` | enviar comentário, kind 10050 na rede, copiar a frase |
| `pages-server.mjs` | servidor estático que imita o GitHub Pages (404.html, `.html`, cache opcional) |
