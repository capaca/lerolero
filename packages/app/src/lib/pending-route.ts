// Tela pedida com o app bloqueado (ao tocar numa notificação, RF-82): o PIN vem antes, e depois dele o app abre
// a tela pedida em vez do início. Só na memória da página: a notificação abre a página ou navega dentro dela.

let pending: string | undefined;

export function savePendingRoute(path: string) {
	pending = path;
}

export function takePendingRoute(): string | undefined {
	const path = pending;
	pending = undefined;
	return path;
}
