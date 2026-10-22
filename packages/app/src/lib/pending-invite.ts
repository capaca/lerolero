// Convite aberto antes de a pessoa entrar no app (sem conta ou bloqueado): guardado
// na sessão do navegador e retomado depois do cadastro ou do PIN.

const KEY = 'lerolero.convitePendente';

export function savePendingInvite(hash: string) {
	try {
		if (hash) sessionStorage.setItem(KEY, hash);
	} catch {
		// sem sessionStorage (modo privado restrito): a pessoa abre o link de novo
	}
}

export function takePendingInvite(): string | undefined {
	try {
		const hash = sessionStorage.getItem(KEY) ?? undefined;
		sessionStorage.removeItem(KEY);
		return hash;
	} catch {
		return undefined;
	}
}
