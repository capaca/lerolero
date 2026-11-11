// Onde este aparelho recebe os avisos (ADR-0010 e ADR-0011). No navegador, a inscrição do Web Push, uma por
// aparelho, presa à chave VAPID deste aparelho: trocar a chave (ao bloquear alguém) cancela a inscrição antiga, e o
// endereço que o bloqueado tinha deixa de servir. No app nativo, o token do FCM e o par de cifra do plugin Avisos.

import { fromBase64Url, generateVapid, targetKey, type PushTarget, type WebPushTarget } from '@lerolero/core';
import { isInstalled, isIOS } from './platform.ts';
import { disableNativePush, enableNativePush, isNativeApp, nativePushState } from './push-native.ts';

/** A pessoa (ou o sistema) recusou a permissão. `blocked`: já estava bloqueada, e ninguém nem pergunta. */
export class PushPermissionError extends Error {
	constructor(readonly blocked: boolean) {
		super(blocked ? 'notificações bloqueadas' : 'notificações recusadas');
	}
}

/** `instalar`: iPhone pelo Safari, que só recebe push com o app na tela de início (iOS 16.4+). */
export function pushSupport(): 'sim' | 'nao' | 'instalar' {
	if (isNativeApp()) return 'sim';
	if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) return 'sim';
	return isIOS() && !isInstalled() ? 'instalar' : 'nao';
}

/** Sem onde receber o aviso: o app em `vite dev` não tem service worker, e um APK sem o Firebase não tem o FCM. */
export class NoServiceWorkerError extends Error {}

/** O serviço de push do navegador (FCM no Chrome) às vezes não responde: sem isto, a tela ficava esperando. */
const SUBSCRIBE_TIMEOUT_MS = 20_000;

/** A permissão de notificações agora; sem suporte, `denied`. */
export async function pushPermission(): Promise<'granted' | 'denied' | 'prompt'> {
	if (isNativeApp()) return (await nativePushState().catch(() => ({ permissao: 'denied' as const }))).permissao;
	if (!('Notification' in window)) return 'denied';
	return Notification.permission === 'default' ? 'prompt' : Notification.permission;
}

async function subscribeWeb(vapidPublicKey: string): Promise<Omit<WebPushTarget, 'vapid'>> {
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

/**
 * Pede a permissão e se inscreve. No navegador, sempre com uma chave VAPID nova. No app nativo, `renew` troca também
 * o token e o par de cifra (ao bloquear alguém); sem ele, mantém o par e pega o token de agora.
 */
export async function newPushTarget(renew = false): Promise<PushTarget> {
	if (isNativeApp()) {
		try {
			return await enableNativePush(renew);
		} catch (e) {
			const code = (e as { code?: string }).code;
			if (code === 'negada' || code === 'bloqueada') throw new PushPermissionError(code === 'bloqueada');
			if (code === 'sem-suporte') throw new NoServiceWorkerError();
			throw e;
		}
	}
	const vapid = await generateVapid();
	return { ...(await subscribeWeb(vapid.publicKey)), vapid };
}

export async function unsubscribePush() {
	if (isNativeApp()) return disableNativePush();
	const registration = await navigator.serviceWorker?.getRegistration();
	await (await registration?.pushManager.getSubscription())?.unsubscribe();
}

/**
 * Onde este aparelho recebe os avisos agora (o `targetKey`); sem permissão, nenhum. Muda sem o app saber quando a
 * pessoa tira a permissão nas configurações, o navegador renova a inscrição (`pushsubscriptionchange`) ou o FCM troca
 * o token do app nativo.
 */
export async function currentPushKey(): Promise<string | undefined> {
	if (isNativeApp()) {
		const { permissao, fcm } = await nativePushState();
		return permissao === 'granted' && fcm ? targetKey({ fcm, p256dh: '', auth: '' }) : undefined;
	}
	if (pushSupport() !== 'sim' || Notification.permission !== 'granted') return undefined;
	const registration = await navigator.serviceWorker.getRegistration();
	return (await registration?.pushManager.getSubscription())?.endpoint;
}
