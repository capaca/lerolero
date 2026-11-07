// Aviso de versão nova no app Android (item 27, ADR-0011): o APK sai na Release do GitHub e não se atualiza sozinho.
// O app lê a última Release pela API do GitHub e compara com a versão embutida. A resposta vem de fora do app: só o
// número da versão é aproveitado, e o endereço do download é montado aqui, nunca copiado da resposta.

/** Nome fixo do APK na Release, para o link e o Obtainium acharem sempre o mesmo arquivo. */
export const APK_FILE = 'lerolero.apk';

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

function parseVersion(version: string): number[] | undefined {
	const match = SEMVER.exec(version);
	return match ? match.slice(1).map(Number) : undefined;
}

/** A versão da última Release, se ela for mais nova que a do app e já tiver o APK; senão, nada. */
export function newerApkRelease(current: string, latest: unknown): string | undefined {
	const mine = parseVersion(current);
	// "dev" e "homolog-…" não são versões: o APK de teste não pede atualização
	if (!mine || typeof latest !== 'object' || latest === null) return;
	const { tag_name, draft, prerelease, assets } = latest as Record<string, unknown>;
	if (draft || prerelease || typeof tag_name !== 'string' || !tag_name.startsWith('v')) return;
	const theirs = parseVersion(tag_name.slice(1));
	if (!theirs) return;
	const hasApk = Array.isArray(assets) && assets.some((a) => (a as { name?: unknown } | null)?.name === APK_FILE);
	if (!hasApk) return;
	for (let i = 0; i < 3; i++) {
		if (theirs[i] !== mine[i]) return theirs[i] > mine[i] ? tag_name.slice(1) : undefined;
	}
}

/** O endereço do APK de uma versão, na Release do repositório. */
export const apkDownloadUrl = (repository: string, version: string) =>
	`https://github.com/${repository}/releases/download/v${version}/${APK_FILE}`;
