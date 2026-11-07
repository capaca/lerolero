#!/usr/bin/env bash
# O e2e roda depois do merge, na main (ADR-0006, 2026-11-06): vermelho na main é o primeiro item da próxima volta, e
# nenhuma release sai dele. Este script é a consulta única que o situacao.sh, o pr.sh, o release.sh e o release.yml
# usam, para a trava não depender de cada um lembrar a regra.
# Uso:
#   scripts/e2e-main.sh linha            uma linha para o situacao.sh: o último e2e da main e a issue aberta
#   scripts/e2e-main.sh trava <commit>   sai com 0 se a release desse commit pode sair; senão diz por quê e sai com 1
set -uo pipefail

cd "$(dirname "$0")/.."
repo=capaca/lerolero

# Os caminhos que disparam o e2e.yml na main: mantenha igual ao `paths` de lá.
CAMINHOS=(packages/app packages/core packages/e2e package.json pnpm-lock.yaml pnpm-workspace.yaml .node-version
	.github/workflows/e2e.yml)

issue_aberta() {
	gh issue list -R $repo --label e2e-main --state open --json number,url --jq '.[0] // empty | "#\(.number) \(.url)"'
}

case "${1:-}" in
	linha)
		ultimo=$(gh run list -R $repo --workflow e2e.yml --branch main --event push --limit 1 \
			--json conclusion,status,headSha,createdAt,url --jq '.[0] // empty |
				"\(.conclusion // .status) em \(.headSha[0:7]) (\(.createdAt[0:10]))" +
				(if .conclusion == "failure" then ", CONSERTE PRIMEIRO: \(.url)" else "" end)' 2>/dev/null) ||
			{ echo "E2E main:    (gh falhou)"; exit 0; }
		echo "E2E main:    ${ultimo:-nenhuma rodada ainda}"
		issue=$(issue_aberta 2>/dev/null) && [ -n "$issue" ] && echo "             issue aberta $issue"
		exit 0
		;;
	trava)
		commit=${2:?commit da release}
		# Falha fechada: se não dá para perguntar ao GitHub, recusa em vez de liberar.
		issue=$(issue_aberta) || { echo "não deu para consultar o e2e da main (gh falhou)"; exit 1; }
		[ -n "$issue" ] && { echo "o e2e está vermelho na main: issue $issue"; exit 1; }
		# A release publica o commit da homologação (ADR-0007), que pode ser só de docs, sem rodada própria: vale a do
		# último commit até ele que mexeu no que o e2e testa.
		alvo=$(git log -1 --format=%H "$commit" -- "${CAMINHOS[@]}") ||
			{ echo "não achei o commit $commit (faça git fetch)"; exit 1; }
		[ -z "$alvo" ] && { echo "nenhum commit até ${commit:0:7} mexeu no que o e2e testa"; exit 1; }
		rodada=$(gh run list -R $repo --workflow e2e.yml --branch main --event push --commit "$alvo" --limit 1 \
			--json conclusion,status,url --jq '.[0] // empty | "\(.conclusion // .status) \(.url)"') ||
			{ echo "não deu para consultar o e2e da main (gh falhou)"; exit 1; }
		case "$rodada" in
			success*) exit 0 ;;
			"") echo "o e2e não rodou em ${alvo:0:7} (cancelado por um merge seguinte?): rode de novo pelo Actions"; exit 1 ;;
			cancelled*) echo "o e2e de ${alvo:0:7} foi cancelado por um merge seguinte: gh run rerun ${rodada##*/}"; exit 1 ;;
			*) echo "o e2e de ${alvo:0:7} está ${rodada%% *}: ${rodada#* }"; exit 1 ;;
		esac
		;;
	*)
		sed -n '5,7p' "$0" | sed 's/^# //'
		exit 2
		;;
esac
