// Inscrição do navegador no Web Push (ADR-0010): uma por aparelho, presa à chave VAPID deste aparelho. Trocar a
// chave (ao bloquear alguém) cancela a inscrição antiga, e o endereço que o bloqueado tinha deixa de servir.

import { fromBase64Url, type PushTarget } from '@lerolero/core';
import { isInstalled, isIOS } from './platform.ts';

/** A pessoa (ou o navegador) recusou a permissão. `blocked`: já estava bloqueada, e o navegador nem pergunta. */
export class PushPermissionError extends Error {
	constructor(readonly blocked: boolean) {
		super(blocked ? 'notificações bloqueadas' : 'notificações recusadas');
	}
}

/** `instalar`: iPhone pelo Safari, que só recebe push com o app na tela de início (iOS 16.4+). */
export function pushSupport(): 'sim' | 'nao' | 'instalar' {
	if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) return 'sim';
	return isIOS() && !isInstalled() ? 'instalar' : 'nao';
}

/** Sem o service worker (o app em `vite dev` não tem), não há onde receber o aviso. */
export class NoServiceWorkerError extends Error {}

/** O serviço de push do navegador (FCM no Chrome) às vezes não responde: sem isto, a tela ficava esperando. */
const SUBSCRIBE_TIMEOUT_MS = 20_000;

export async function subscribePush(vapidPublicKey: string): Promise<Omit<PushTarget, 'vapid'>> {
	// `serviceWorker.ready` nunca resolve sem service worker; o registro sai junto com a página
	const registration = await navigator.serviceWorker.getRegistration();
	if (!registration) throw new NoServiceWorkerError();
	const blocked = Notification.permission === 'denied';
	if (blocked || (await Notification.requestPermission()) !== 'granted') throw new PushPermissionError(blocked);
	await (await registration.pushManager.getSubscription())?.unsubscribe();
	// userVisibleOnly: o Chrome só aceita assim, e o service worker sempre mostra a notificação
	const subscription = await Promise.race([
		registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromBase64Url(vapidPublicKey) }),
		new Promise<never>((_, fail) => setTimeout(() => fail(new Error('o serviço de push não respondeu')), SUBSCRIBE_TIMEOUT_MS))
	]);
	const keys = subscription.toJSON().keys;
	if (!keys?.p256dh || !keys.auth) throw new Error('inscrição sem as chaves de cifra');
	return { endpoint: subscription.endpoint, p256dh: keys.p256dh, auth: keys.auth };
}

export async function unsubscribePush() {
	const registration = await navigator.serviceWorker?.getRegistration();
	await (await registration?.pushManager.getSubscription())?.unsubscribe();
}

/**
 * O endereço em que o navegador entrega os avisos agora; sem permissão, nenhum. Muda sem o app saber quando a
 * pessoa tira a permissão nas configurações ou o navegador renova a inscrição (`pushsubscriptionchange`).
 */
export async function currentPushEndpoint(): Promise<string | undefined> {
	if (pushSupport() !== 'sim' || Notification.permission !== 'granted') return undefined;
	const registration = await navigator.serviceWorker.getRegistration();
	return (await registration?.pushManager.getSubscription())?.endpoint;
}
