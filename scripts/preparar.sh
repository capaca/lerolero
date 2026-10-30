#!/usr/bin/env bash
# Monta o ambiente de desenvolvimento numa máquina nova, no macOS (com Homebrew) ou no Debian/Ubuntu (com apt e sudo).
# Pode rodar de novo a qualquer momento (depois de trocar a versão do Node ou do pnpm, por exemplo): só instala o que
# falta.
# Uso: scripts/preparar.sh
set -euo pipefail

cd "$(dirname "$0")/.."

como_root() { if [ "$(id -u)" -eq 0 ]; then "$@"; else sudo "$@"; fi; }

preparar_macos() {
	if ! command -v brew >/dev/null; then
		echo "Falta o Homebrew: instale por https://brew.sh e rode este script de novo."
		exit 1
	fi
	for ferramenta in git gh fnm; do
		command -v "$ferramenta" >/dev/null || brew install "$ferramenta"
	done
	# O e2e usa o Chrome instalado (channel: 'chrome' no playwright.config.ts), não um baixado pelo Playwright.
	if [ ! -d "/Applications/Google Chrome.app" ] && [ ! -d "$HOME/Applications/Google Chrome.app" ]; then
		brew install --cask google-chrome
	fi
}

preparar_linux() {
	if ! command -v apt-get >/dev/null; then
		echo "Este script conhece só Debian e Ubuntu. Em outra distribuição, siga \"Montar o ambiente\" no README."
		exit 1
	fi
	como_root apt-get update -qq
	como_root apt-get install -y -qq git curl unzip ca-certificates

	# gh pelo repositório oficial: o do apt é antigo.
	if ! command -v gh >/dev/null; then
		curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg |
			como_root tee /usr/share/keyrings/githubcli-archive-keyring.gpg >/dev/null
		echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" |
			como_root tee /etc/apt/sources.list.d/github-cli.list >/dev/null
		como_root apt-get update -qq
		como_root apt-get install -y -qq gh
	fi

	# Em ~/.local/bin, e não na pasta padrão do instalador, para os outros scripts acharem o fnm.
	export PATH="$HOME/.local/bin:$PATH"
	if ! command -v fnm >/dev/null; then
		curl -fsSL https://fnm.vercel.app/install | bash -s -- --install-dir "$HOME/.local/bin" --skip-shell
	fi

	# O Google só publica o Chrome para Linux em amd64.
	if ! command -v google-chrome >/dev/null; then
		if [ "$(dpkg --print-architecture)" = amd64 ]; then
			deb=$(mktemp --suffix=.deb)
			curl -fsSL -o "$deb" https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
			chmod 644 "$deb"
			como_root apt-get install -y -qq "$deb"
			rm -f "$deb"
		else
			echo "Sem Google Chrome para esta arquitetura: a suíte e2e não vai rodar aqui."
		fi
	fi
}

case "$(uname)" in
	Darwin) preparar_macos ;;
	Linux) preparar_linux ;;
	*) echo "Sistema desconhecido. Siga \"Montar o ambiente\" no README."; exit 1 ;;
esac

# O Node global do sistema não serve: a versão vem do .node-version, a mesma da CI.
eval "$(fnm env --version-file-strategy=recursive --shell bash)"
fnm install --version-file-strategy=recursive
fnm use --silent-if-unchanged

# O pnpm vem do corepack, na versão do campo packageManager do package.json.
corepack enable
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
pnpm install --frozen-lockfile

echo
echo "✓ Node $(node -v), pnpm $(pnpm -v), $(git --version), $(gh --version | head -1)"

# Estes dois dependem de você: entrar na conta e mexer no perfil do shell ficam fora do script.
if ! gh auth status >/dev/null 2>&1; then
	echo "Falta entrar no GitHub (scripts/situacao.sh, pr.sh e release.sh precisam): gh auth login"
fi
case "$(basename "${SHELL:-bash}")" in
	zsh) shell=zsh; perfil="$HOME/.zshrc" ;;
	*) shell=bash; perfil="$HOME/.bashrc" ;;
esac
if ! grep -qs 'fnm env' "$perfil"; then
	echo "Para ter node e pnpm no terminal, acrescente ao $perfil:"
	[ "$(uname)" = Linux ] && echo '  export PATH="$HOME/.local/bin:$PATH"'
	echo "  eval \"\$(fnm env --use-on-cd --version-file-strategy=recursive --shell $shell)\""
fi
echo "Para conferir: scripts/verificar.sh"
