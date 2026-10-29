#!/usr/bin/env bash
# O ciclo do PR em poucos comandos, com uma linha por coisa e os links que o Pedro acompanha (economiza contexto do
# assistente). O commit continua manual, com caminhos explícitos (nunca `git add -A`).
# Uso:
#   scripts/pr.sh abrir "<título>" <arquivo-do-corpo>   push, PR, rótulos dos testes e links
#   scripts/pr.sh rotular [nº]                          pede a rodada de novo (depois de um push ou de uma falha)
#   scripts/pr.sh esperar [nº]                          espera os 3 checks do merge; se falhar, mostra o erro
#   scripts/pr.sh homologacao                           depois do merge: espera a publicação e confere o commit.txt
set -uo pipefail

cd "$(dirname "$0")/.."
repo=capaca/lerolero
runs="https://github.com/$repo/actions/runs"

# Links das execuções de um workflow neste branch criadas a partir de um instante (ISO, UTC). As execuções levam
# alguns segundos para aparecer: tenta por até ~30 s até achar `quantas`.
links_desde() {
	local workflow=$1 desde=$2 quantas=$3 branch achou
	branch=$(git branch --show-current)
	for _ in $(seq 10); do
		achou=$(gh run list -R $repo --branch "$branch" --workflow "$workflow" --limit 10 \
			--json databaseId,createdAt,name --jq "[.[] | select(.createdAt >= \"$desde\")] | reverse | .[]
				| \"  \(.name): $runs/\(.databaseId)\"")
		[ "$(printf '%s' "$achou" | grep -c .)" -ge "$quantas" ] && break
		sleep 3
	done
	[ -n "$achou" ] && echo "$achou" || echo "  ($workflow ainda não apareceu: gh run list --branch $branch)"
}

agora() { date -u +%Y-%m-%dT%H:%M:%SZ; }

# PR só de documentação dispensa os testes sob demanda (o workflow já marca os dois status como dispensados).
so_docs() { ! gh pr diff "$1" -R $repo --name-only | grep -qvE '^docs/|\.md$'; }

# Os rótulos só disparam a rodada num evento novo: se já estiverem no PR, tira e põe de novo.
rotular() {
	local pr=$1 desde
	if so_docs "$pr"; then echo "Só documentação: testes de integração e e2e dispensados"; return; fi
	gh pr edit "$pr" -R $repo --remove-label integration-tests,e2e-tests >/dev/null 2>&1
	sleep 3
	desde=$(agora)
	gh pr edit "$pr" -R $repo --add-label integration-tests,e2e-tests >/dev/null || return 1
	echo "Rótulos postos. Rodadas:"
	links_desde testes-sob-demanda.yml "$desde" 2
}

numero() { [ -n "${1:-}" ] && echo "$1" || gh pr view --json number --jq .number; }

case "${1:-}" in
	abrir)
		titulo=${2:?título do PR}; corpo=${3:?arquivo com o corpo do PR}
		[ -n "$(git status --porcelain --untracked-files=no)" ] && echo "Aviso: há alterações sem commit (ficam fora do PR)"
		desde=$(agora)
		git push -q -u origin HEAD 2>&1 | grep -v '^remote:' || true
		url=$(gh pr create -R $repo --title "$titulo" --body-file "$corpo") || exit 1
		echo "PR: $url"
		echo "CI:"
		links_desde ci.yml "$desde" 1
		rotular "${url##*/}"
		;;
	rotular)
		rotular "$(numero "${2:-}")"
		;;
	esperar)
		pr=$(numero "${2:-}")
		# `--required` mostra só os checks que o merge exige; cada um aparece uma vez no fim.
		gh pr checks "$pr" -R $repo --watch --required --interval 20 >/dev/null 2>&1
		resultado=$(gh pr checks "$pr" -R $repo --required 2>/dev/null)
		echo "$resultado" | awk -F'\t' '{ printf "%s %s  %s\n", ($2 == "pass" ? "✓" : "✗"), $1, $4 }'
		echo "$resultado" | awk -F'\t' '$2 != "pass" { print $4 }' | grep -oE 'runs/[0-9]+' | sort -u | cut -d/ -f2 |
			while read -r id; do
				# Linhas do log: job, passo, carimbo de hora e texto. Mostra o passo e as linhas de erro (ou o fim).
				log=$(gh run view "$id" -R $repo --log-failed 2>/dev/null)
				echo "--- falha em $runs/$id, passo: $(echo "$log" | tail -1 | cut -f2)"
				texto=$(echo "$log" | cut -f3- | sed -E 's/^[0-9T:.-]+Z ?//' | grep -vE '^\s*$|##\[|^\s*✓')
				erros=$(echo "$texto" | grep -E 'Error|error TS|expect|Expected|Received|✘|failed|FAIL|›' | awk '!visto[$0]++' | head -30)
				[ -n "$erros" ] && echo "$erros" || echo "$texto" | tail -30
			done
		echo "$resultado" | awk -F'\t' '$2 != "pass" { exit 1 }'
		;;
	homologacao)
		id=$(gh run list -R $repo --workflow homologacao.yml --limit 1 --json databaseId --jq '.[0].databaseId')
		echo "Homologação: $runs/$id"
		gh run watch "$id" -R $repo --exit-status --interval 15 >/dev/null 2>&1 && echo "✓ publicada" || echo "✗ falhou"
		homolog=$(gh api 'repos/lerolero-app/lerolero/contents/commit.txt?ref=gh-pages' --jq .content | base64 -d | tr -d '[:space:]')
		git fetch -q origin
		echo "commit.txt: $(git log -1 --format='%h %s' "$homolog" | cut -c1-110)"
		[ "$homolog" = "$(git rev-parse origin/main)" ] && echo "= ponta da main" || echo "≠ ponta da main ($(git rev-parse --short origin/main))"
		echo "No ar em ~1 min (cache do Pages até 10): https://lerolero-app.github.io/lerolero/"
		;;
	*)
		sed -n '4,8p' "$0" | sed 's/^# //'
		exit 2
		;;
esac
