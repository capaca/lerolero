#!/usr/bin/env bash
# Retrato do projeto em poucas linhas, para o começo de cada sessão: o que está em produção e na homologação, o que
# espera release, os PRs abertos, o branch local e o próximo item do roadmap. Substitui ler a memória de status e o
# roadmap inteiro (economiza contexto do assistente); o que não sai daqui (validações pendentes, decisões em aberto)
# continua na memória.
# Uso: scripts/situacao.sh
set -uo pipefail

cd "$(dirname "$0")/.."
git fetch -q origin --tags 2>/dev/null || echo "(sem rede: dados do último fetch)"

tag=$(git describe --tags --abbrev=0 origin/main 2>/dev/null)
echo "Produção:    $tag ($(git log -1 --format=%ad --date=short "$tag"))"

# A release publica o commit da homologação, não a ponta da main (ADR-0007).
homolog=$(gh api 'repos/lerolero-app/lerolero/contents/commit.txt?ref=gh-pages' --jq .content 2>/dev/null | base64 -d | tr -d '[:space:]')
if [ -n "$homolog" ]; then
	echo "Homologação: $(git log -1 --format='%h %s' "$homolog" | cut -c1-110)"
	# Merge só de docs não vai para a homologação: aí ficar atrás da main é o normal.
	if [ "$(git rev-parse origin/main)" != "$(git rev-parse "$homolog")" ] &&
		git diff --name-only "$homolog" origin/main | grep -qvE '^docs/|\.md$'; then
		echo "             (atrás da main: a publicação pode estar em andamento)"
	fi
else
	echo "Homologação: não consegui ler o commit.txt"
fi

pendentes=$(git log --format='  %h %s' "$tag"..origin/main | cut -c1-120)
if [ -n "$pendentes" ]; then
	echo "Na main desde $tag (sem release):"
	echo "$pendentes"
else
	echo "Na main desde $tag: nada"
fi

# Pages guarda o HTML por ~10 min: duas releases seguidas já deram tela branca.
gh run list --workflow release.yml --limit 1 --json createdAt,status,conclusion \
	--jq '.[0] | "Última release: \(.createdAt[0:16] | sub("T"; " ")) UTC, \(.conclusion // .status)"' 2>/dev/null

# Só os três checks que o merge exige: `verificar` (ci.yml) e os dois status gravados pelos testes sob demanda.
echo "PRs abertos:"
gh pr list --json number,title,headRefName,autoMergeRequest,statusCheckRollup --jq '
	if length == 0 then "  nenhum" else .[] |
		"  #\(.number) \(.title[0:70]) [\(.headRefName)]\(if .autoMergeRequest then " auto-merge" else "" end)\n     " +
		([.statusCheckRollup[] | select(.context or .name == "verificar")
			| "\(.name // .context): \((.conclusion // .state // .status) | ascii_downcase)"] | join(" · "))
	end' 2>/dev/null || echo "  (gh falhou)"

branch=$(git branch --show-current)
alteracoes=$(git status --porcelain | wc -l | tr -d ' ')
echo "Local:       $branch, $(git rev-list --count origin/main..HEAD) commit(s) à frente e $(git rev-list --count HEAD..origin/main) atrás da main, $alteracoes arquivo(s) alterado(s)"

# Sessões paralelas usam as mesmas portas fixas (e2e na 4190, celular.sh na 5180).
for porta in 4190 5180; do
	lsof -iTCP:$porta -sTCP:LISTEN -t >/dev/null 2>&1 && echo "Porta $porta ocupada (outra sessão?)"
done

# Item concluído termina com "✅ Feita em": o primeiro sem a marca é o próximo.
echo "Próximos itens do roadmap (docs/07-roadmap.md):"
sed -n '/^### Ordem do restante do MVP/,/^\*\*/p' docs/07-roadmap.md | grep -E '^[0-9]+\. ' | grep -v '✅ Feit' | head -3 | cut -c1-140 | sed 's/^/  /'
