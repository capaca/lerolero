#!/usr/bin/env bash
# A release em três passos curtos (ADR-0007). `disparar` fica separado de `acompanhar` de propósito: um comando
# interrompido no meio já publicou uma versão sem que se percebesse (v0.6.0, 2026-10-28).
# Uso:
#   scripts/release.sh preparar            o que sai (commits da tag até a homologação), o que fica e o alerta de cache
#   scripts/release.sh disparar minor|patch   dispara a release (só depois da confirmação do Pedro) e mostra o link
#   scripts/release.sh acompanhar          espera a última release e mostra a versão e o link da Release
set -uo pipefail

cd "$(dirname "$0")/.."
repo=capaca/lerolero
runs="https://github.com/$repo/actions/runs"

homologacao() {
	gh api 'repos/lerolero-app/lerolero/contents/commit.txt?ref=gh-pages' --jq .content | base64 -d | tr -d '[:space:]'
}

# Minutos desde a última release; o Pages guarda o HTML por ~10 min e deploys seguidos já deram tela branca.
minutos_desde_release() {
	local criada
	criada=$(gh run list -R $repo --workflow release.yml --limit 1 --json createdAt --jq '.[0].createdAt')
	[ -z "$criada" ] && { echo 9999; return; }
	echo $(( ($(date -u +%s) - $(date -j -u -f %Y-%m-%dT%H:%M:%SZ "$criada" +%s)) / 60 ))
}

case "${1:-}" in
	preparar)
		git fetch -q origin --tags
		tag=$(git describe --tags --abbrev=0 origin/main)
		homolog=$(homologacao)
		echo "Última versão: $tag"
		echo "Homologação:   $(git log -1 --format='%h %s' "$homolog" | cut -c1-110)"
		if git merge-base --is-ancestor "$homolog" "$tag"; then
			echo "Nada novo na homologação desde $tag."
		else
			# "Bastidores", testes e docs não mudam o que o testador faz: sozinhos não pedem release.
			echo "Sai na release (de $tag até a homologação):"
			git log --format='%h %s' "$tag..$homolog" | cut -c1-120 | while read -r linha; do
				if echo "$linha" | grep -qiE 'Bastidores|\(docs\)|^[0-9a-f]+ (Teste|Testes) '; then
					echo "  [sem release] $linha"
				else
					echo "  $linha"
				fi
			done
		fi
		fora=$(git log --format='  %h %s' "$homolog..origin/main" | cut -c1-120)
		[ -n "$fora" ] && { echo "Na main mas fora da homologação (não sai):"; echo "$fora"; }
		echo "Última release há $(minutos_desde_release) min."
		echo "Tipo: minor se algo muda o que o testador vê ou faz; patch se só corrige; nada se tudo é [sem release]."
		;;
	disparar)
		tipo=${2:-}
		[[ "$tipo" =~ ^(minor|patch)$ ]] || { echo "use: scripts/release.sh disparar minor|patch"; exit 2; }
		min=$(minutos_desde_release)
		[ "$min" -lt 10 ] && { echo "Última release há $min min: espere o cache do Pages (10 min)."; exit 1; }
		desde=$(date -u +%Y-%m-%dT%H:%M:%SZ)
		gh workflow run release.yml -R $repo -f tipo="$tipo" || exit 1
		echo "Release $tipo disparada."
		for _ in $(seq 10); do
			id=$(gh run list -R $repo --workflow release.yml --limit 1 --json databaseId,createdAt \
				--jq ".[] | select(.createdAt >= \"$desde\") | .databaseId")
			[ -n "$id" ] && { echo "Execução: $runs/$id"; exit 0; }
			sleep 3
		done
		echo "A execução ainda não apareceu: gh run list --workflow release.yml"
		;;
	acompanhar)
		id=$(gh run list -R $repo --workflow release.yml --limit 1 --json databaseId --jq '.[0].databaseId')
		echo "Execução: $runs/$id"
		if gh run watch "$id" -R $repo --exit-status --interval 15 >/dev/null 2>&1; then
			echo "✓ $(gh release view -R $repo --json tagName,url --jq '"\(.tagName): \(.url)"')"
		else
			echo "✗ falhou:"
			gh run view "$id" -R $repo --log-failed 2>/dev/null | cut -f3- | sed -E 's/^[0-9T:.-]+Z ?//' |
				grep -vE '^\s*$' | tail -20
			exit 1
		fi
		;;
	*)
		sed -n '4,7p' "$0" | sed 's/^# //'
		exit 2
		;;
esac
