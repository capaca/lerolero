// Inscrição do navegador no Web Push (ADR-0010): uma por aparelho, presa à chave VAPID deste aparelho. Trocar a
// chave (ao bloquear alguém) cancela a inscrição antiga, e o endereço que o bloqueado tinha deixa de servir.

import { fromBase64Url, type PushTarget } from '@lerolero/core';

export async function subscribePush(vapidPublicKey: string): Promise<Omit<PushTarget, 'vapid'>> {
	const registration = await navigator.serviceWorker.ready;
	await (await registration.pushManager.getSubscription())?.unsubscribe();
	// userVisibleOnly: o Chrome só aceita assim, e o service worker sempre mostra a notificação
	const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromBase64Url(vapidPublicKey) });
	const keys = subscription.toJSON().keys;
	if (!keys?.p256dh || !keys.auth) throw new Error('inscrição sem as chaves de cifra');
	return { endpoint: subscription.endpoint, p256dh: keys.p256dh, auth: keys.auth };
}
