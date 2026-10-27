#!/usr/bin/env bash
# Roda check, test e build como a CI, mostrando uma linha por etapa e só o fim da saída de quem falhar.
# A saída completa fica em arquivos de log, para ler só se precisar (economiza contexto do assistente).
# Uso: scripts/verificar.sh [check] [test] [build] [e2e]   (sem argumentos roda as três primeiras)
# e2e usa o build da etapa anterior: peça `build e2e` depois de mudar o app.
set -uo pipefail

cd "$(dirname "$0")/.."
eval "$(fnm env --version-file-strategy=recursive --shell bash)" && fnm use --silent-if-unchanged >/dev/null

etapas=("$@")
[ ${#etapas[@]} -eq 0 ] && etapas=(check test build)

logs="${TMPDIR:-/tmp}"; logs="${logs%/}/lerolero-verificar"
mkdir -p "$logs"
falhou=0

for etapa in "${etapas[@]}"; do
	log="$logs/$etapa.log"
	inicio=$SECONDS
	case "$etapa" in
		check) pnpm check >"$log" 2>&1 ;;
		test) pnpm test >"$log" 2>&1 ;;
		# o segundo build é o da pseudolíngua, para o teste de textos fixos do e2e (ADR-0008)
		build) { BASE_PATH=/lerolero pnpm build && pnpm --filter @lerolero/app build:pseudo; } >"$log" 2>&1 ;;
		e2e) (cd packages/e2e && pnpm e2e) >"$log" 2>&1 ;;
		*) echo "etapa desconhecida: $etapa (use check, test, build ou e2e)"; exit 2 ;;
	esac
	status=$?
	if [ $status -eq 0 ]; then
		echo "✓ $etapa ($((SECONDS - inicio)) s)"
	else
		falhou=1
		echo "✗ $etapa ($((SECONDS - inicio)) s) — log completo: $log"
		# Erros do tsc/svelte-check e falhas do vitest; se não achar nada, o fim do log.
		erros=$(grep -E 'error|Error|FAIL|✗|×|✘|AssertionError|expected|Expected|Received' "$log" | grep -v 'svelte-check found 0 errors' | head -40)
		if [ -n "$erros" ]; then echo "$erros"; else tail -30 "$log"; fi
	fi
done

exit $falhou
