#!/usr/bin/env bash
# Abre o app em desenvolvimento no celular, pela rede Wi-Fi, para revisar mudanças de tela antes do PR
# (cada ajuste aparece na hora, sem PR, homologação e release a cada tentativa).
# Uso: scripts/celular.sh   (Ctrl+C para parar)
#
# O cofre (Web Worker + crypto) e o service worker exigem contexto seguro, e http://IP não é. No Chrome do
# celular, uma vez só: chrome://flags/#unsafely-treat-insecure-origin-as-secure, colar o endereço que este
# script mostra, Enabled e Relaunch. Se o IP do Mac mudar, o endereço da flag precisa mudar junto.
# A origem é outra que a da produção e a da homologação: os dados de lá não são tocados.
# Instalado (menu do Chrome → Instalar app ou Adicionar à tela inicial), aparece como "Lero local", com a barra e a
# moldura roxas (vite.config.ts), para não confundir com o da produção nem com o da homologação.
set -uo pipefail

cd "$(dirname "$0")/.."
eval "$(fnm env --version-file-strategy=recursive --shell bash)" && fnm use --silent-if-unchanged >/dev/null

# porta fixa para a flag do Chrome continuar valendo; fora da 4190 do e2e e da 5173 padrão do vite
porta=5180
ip=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
if [ -z "$ip" ]; then
	echo "Não achei o IP do Wi-Fi deste Mac. Ele está conectado?"
	exit 1
fi
url="http://$ip:$porta/"

echo
echo "No celular (mesmo Wi-Fi): $url"
(cd packages/app && node -e '
	const { renderUnicodeCompact } = require("uqr");
	console.log(renderUnicodeCompact(process.argv[1], { border: 1 }));
' "$url")
echo "Primeira vez: chrome://flags/#unsafely-treat-insecure-origin-as-secure → colar $url → Enabled → Relaunch"
echo

cd packages/app && exec pnpm exec vite dev --host 0.0.0.0 --port "$porta" --strictPort
