#!/usr/bin/env bash
# Cria a chave que assina o APK de verdade (ADR-0011) e a guarda nos secrets do ambiente `apk` do GitHub, que só a
# `main` usa: um PR não chega à chave. Roda uma vez só. Trocar a chave obriga quem já instalou a desinstalar o app
# (e perder a conta neste aparelho), por isso o script se recusa a criar outra se o ambiente já tiver uma.
# Uso: packages/android/scripts/chave.sh <pasta para a cópia de segurança>
set -euo pipefail

repo=capaca/lerolero
destino=${1:?use: chave.sh <pasta para a cópia de segurança, fora do repositório>}

if gh secret list -R $repo --env apk 2>/dev/null | grep -q '^APK_CHAVE_BASE64'; then
	echo "O ambiente apk já tem uma chave. Não crio outra: o APK novo não instalaria por cima do antigo." >&2
	exit 1
fi
mkdir -p "$destino"
chave="$destino/lerolero-apk.p12"
[ -e "$chave" ] && { echo "Já existe $chave: use essa ou mova-a antes." >&2; exit 1; }

senha=$(openssl rand -base64 33 | tr -d '/+=' | cut -c1-32)
# 30 anos: a Play pede validade até depois de 2033, e a chave não pode mudar
keytool -genkeypair -storetype PKCS12 -keystore "$chave" -storepass "$senha" -alias lerolero -keyalg RSA \
	-keysize 4096 -validity 10950 -dname 'CN=Lero-lero, O=Lero-lero, C=BR' >/dev/null
printf '%s\n' "$senha" > "$destino/lerolero-apk-senha.txt"
chmod 600 "$chave" "$destino/lerolero-apk-senha.txt"

# ambiente que só a main usa
gh api -X PUT "repos/$repo/environments/apk" --input - >/dev/null <<-'JSON'
	{"deployment_branch_policy": {"protected_branches": false, "custom_branch_policies": true}}
JSON
gh api -X POST "repos/$repo/environments/apk/deployment-branch-policies" -f name=main -f type=branch >/dev/null 2>&1 || true
base64 -i "$chave" | gh secret set APK_CHAVE_BASE64 -R $repo --env apk
printf '%s' "$senha" | gh secret set APK_CHAVE_SENHA -R $repo --env apk

echo "Chave criada e guardada no ambiente apk do GitHub."
echo "Impressão digital (SHA-256), para conferir o APK e registrar o pacote no Google:"
keytool -list -keystore "$chave" -storepass "$senha" -alias lerolero | grep -i sha-256 || true
echo
echo "Guarde agora uma cópia de $chave e da senha ($destino/lerolero-apk-senha.txt) num lugar seguro fora deste"
echo "Mac (gerenciador de senhas). Sem ela, uma versão nova não instala por cima e o registro no Google não sai."
