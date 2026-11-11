// Convite para ativar as notificações (RF-82): na tela inicial, depois da primeira conversa, até a pessoa ativar ou
// dispensar. Só deste aparelho, como a própria notificação; Ajustes continua com a opção.
import { m } from '#lib/paraglide/messages.js';
import { NoServiceWorkerError, pushPermission, pushSupport, PushPermissionError } from './push-subscription.ts';
import { session } from './session.svelte.ts';

const DISMISSED_KEY = 'lerolero:convite-notificacoes-dispensado';

export async function pushOfferDue(): Promise<boolean> {
	// bloqueada, o navegador nem pergunta: o convite só levaria ao erro
	if (pushSupport() !== 'sim' || (await pushPermission()) === 'denied') return false;
	try {
		if (localStorage.getItem(DISMISSED_KEY)) return false;
	} catch {
		return false; // sem armazenamento, o convite voltaria a cada abertura
	}
	return !(await session.pushEnabled());
}

export function dismissPushOffer() {
	try {
		localStorage.setItem(DISMISSED_KEY, '1');
	} catch {
		// sem armazenamento: some só até a próxima abertura
	}
}

/** O que dizer quando ativar ou desativar falhou. */
export function pushErrorMessage(error: unknown): string {
	if (error instanceof NoServiceWorkerError) return m.ajustes_notificacoes_sem_suporte();
	if (!(error instanceof PushPermissionError)) return m.ajustes_notificacoes_erro();
	return error.blocked ? m.ajustes_notificacoes_bloqueada() : m.ajustes_notificacoes_negada();
}
