---
name: testar-no-navegador
description: Confere o Lero-lero num Chrome de verdade (Puppeteer) servido como no GitHub Pages, com microfone e câmera simulados, sem tocar nos dados do Pedro. Use para verificar uma mudança de interface ou fluxo (cadastro, PIN, conversa, áudio, atualização do app) antes de publicar, ou para reproduzir um bug que o Pedro viu no celular. Vale até existir a suíte e2e em packages/e2e.
---

# Testar no navegador

Testes unitários não pegam o que depende do navegador: IndexedDB, Web Worker, service worker, microfone, rotas.
Para isso, rode o build num servidor que imita o GitHub Pages e dirija um Chrome headless com Puppeteer.

Trabalhe sempre no diretório temporário da sessão (o scratchpad), nunca dentro do repositório.

## Montar

```bash
D=<scratchpad>/e2e
mkdir -p $D/site
cd $D && npm init -y >/dev/null && npm i puppeteer-core@24   # só na primeira vez
cd <repo>
eval "$(fnm env --version-file-strategy=recursive --shell bash)" && fnm use
BASE_PATH=/lerolero pnpm build
rm -rf $D/site/lerolero && cp -r packages/app/build $D/site/lerolero
cp prototipos/e2e-rascunho/pages-server.mjs $D/
```

`pages-server.mjs` imita o Pages: `404.html` como fallback, resolve `.html` e aceita `CACHE_SECONDS` para simular o
cache do HTML. Suba-o em segundo plano e derrube no fim:

```bash
cd $D && node pages-server.mjs site 4181   # http://localhost:4181/lerolero/
pkill -f "pages-server.mjs site 4181"
```

Toda mudança no código pede build e cópia de novo.

## Escrever o teste

Parta de [exemplo.mjs](exemplo.mjs): ele cria uma conta e traz os auxiliares. Os rascunhos em
`prototipos/e2e-rascunho/` (veja o README de lá) cobrem quase todos os fluxos e servem de referência.

- Chrome local: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, `headless: 'new'`, tela 400×850.
- Um `createBrowserContext()` por pessoa: cada contexto tem o próprio IndexedDB.
- Botões só com ícone se acham pelo `aria-label` (ex.: `[aria-label="Nova conversa"]`); os outros pelo texto.
- Microfone simulado: `args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']`.
  Câmera: troque `getUserMedia` por um stream de canvas.
- Para simular tempo passando, edite o registro direto no IndexedDB (banco `lerolero`, tabela `settings`).
- `page.goto` recarrega a página (o worker morre e o cofre bloqueia); para navegar sem recarregar, clique nos links.
- Imprima `pageerror` e erros do console: o erro do worker aparece com o nome da classe (ex.: `LockedError`).
- Em heredoc sem aspas, `$$` vira o PID do shell: use `<<'EOF'`.
- Conversa entre duas contas usa os relays reais: a entrega às vezes leva mais de 30 s; use prazos longos.

## Comparar com a versão anterior

Para saber se um problema é novo, gere o build sem a mudança e rode o mesmo teste:

```bash
git stash -q && BASE_PATH=/lerolero pnpm build; git stash pop -q
```

## Telas (capturas)

`page.screenshot({ path })` em 400×820, com `page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])`
para o tema escuro. Olhe a imagem antes de dizer que a tela está certa.

## Relatar

Diga ao Pedro o que foi conferido, passo a passo, e qualquer erro de console que apareceu, mesmo que o teste tenha
passado. Não diga que funciona no celular: o teste é no Chrome do Mac; o celular ele confere.
