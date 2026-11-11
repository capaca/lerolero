// Onde os meus avisos chegam (ADR-0010, RF-82): até 3 aparelhos meus, cada um com a sua inscrição e o seu par
// VAPID, todos no meu cartão de perfil. Os aparelhos combinam a lista entre si por um aviso só para mim mesmo
// (kind 4445): quem ativa, desativa ou troca as chaves conta aos outros, e quem fica sabendo de um aparelho novo se
// apresenta de volta (o novo não viu os avisos antigos, que os relays já apagaram).

import { exclusive } from '../conversations/lock.ts';
import { PUSH_DEVICE_KIND, type Rumor } from '../identity/vault.ts';
import type { Storage } from '../storage/repositories.ts';
import { isNativeTarget, targetKey, toBase64Url, validTarget, type PushTarget } from './webpush.ts';

/** Tag do cartão e do aviso entre aparelhos: endereço, p256dh, auth, VAPID pública e privada. */
export const PUSH_TAG = 'push';
/** O app nativo (ADR-0011): token do FCM, p256dh e auth. Versões antigas ignoram a tag e só não avisam esse aparelho. */
export const FCM_TAG = 'fcm';
/** Aparelhos por pessoa no cartão (decidido em 2026-11-04): o mais recente de cada um vale. */
export const MAX_PUSH_TARGETS = 3;
const DEVICE_TAG = 'aparelho';

/** Id deste aparelho, sorteado na primeira vez; não sai no backup (aparelho novo, id novo). */
const DEVICE_KEY = 'aparelho';
/** O que sei dos meus aparelhos: o aviso mais recente de cada um; sem `target`, desativou (fica, para um aviso velho não o trazer de volta). */
const DEVICES_KEY = 'avisosAparelhos';

export type PushDevice = { target?: PushTarget; at: number };

export function pushTags(targets: PushTarget[]): string[][] {
	return targets
		.slice(0, MAX_PUSH_TARGETS)
		.map((t) => (isNativeTarget(t) ? [FCM_TAG, t.fcm, t.p256dh, t.auth] : [PUSH_TAG, t.endpoint, t.p256dh, t.auth, t.vapid.publicKey, t.vapid.privateKey]));
}

function targetFromTag(t: string[]): PushTarget | undefined {
	if (t[0] === FCM_TAG && t.length >= 4) return { fcm: t[1], p256dh: t[2], auth: t[3] };
	if (t[0] !== PUSH_TAG || t.length < 6) return undefined;
	const [, endpoint, p256dh, auth, publicKey, privateKey] = t;
	return { endpoint, p256dh, auth, vapid: { publicKey, privateKey } };
}

/** Os aparelhos de um cartão ou aviso (dado de fora: o que não confere é descartado). */
export function targetsFromTags(tags: string[][]): PushTarget[] {
	const targets: PushTarget[] = [];
	for (const t of tags) {
		const target = targetFromTag(t);
		if (target && validTarget(target) && !targets.some((o) => targetKey(o) === targetKey(target))) targets.push(target);
	}
	return targets.slice(0, MAX_PUSH_TARGETS);
}

export async function myDeviceId(storage: Storage): Promise<string> {
	const known = await storage.settings.get<string>(DEVICE_KEY);
	if (known) return known;
	const id = toBase64Url(crypto.getRandomValues(new Uint8Array(9)));
	await storage.settings.set(DEVICE_KEY, id);
	return id;
}

async function devices(storage: Storage): Promise<Record<string, PushDevice>> {
	return (await storage.settings.get<Record<string, PushDevice>>(DEVICES_KEY)) ?? {};
}

/** Os aparelhos que vão no meu cartão: os mais recentes, até 3. */
export async function myPushTargets(storage: Storage): Promise<PushTarget[]> {
	return Object.values(await devices(storage))
		.filter((d): d is Required<PushDevice> => !!d.target)
		.sort((a, b) => b.at - a.at)
		.map((d) => d.target)
		.slice(0, MAX_PUSH_TARGETS);
}

/** A inscrição deste aparelho, se as notificações estão ativas aqui. */
export async function myPushTarget(storage: Storage): Promise<PushTarget | undefined> {
	return (await devices(storage))[await myDeviceId(storage)]?.target;
}

/** Tags do aviso aos meus outros aparelhos (kind 4445). */
export function pushDeviceTags(deviceId: string, target: PushTarget | undefined): string[][] {
	return [[DEVICE_TAG, deviceId], ...(target ? pushTags([target]) : [])];
}

/**
 * Ativa (com `target`) ou desativa as notificações neste aparelho. Devolve as tags do aviso aos meus outros
 * aparelhos; o cartão muda sozinho (myPushTargets) e sai de novo para os contatos.
 */
export async function setMyPushTarget(storage: Storage, target: PushTarget | undefined, now = Date.now()): Promise<string[][]> {
	const id = await myDeviceId(storage);
	await exclusive(storage, async () => {
		const known = await devices(storage);
		// no mesmo segundo de um aviso anterior, ainda sai como o mais novo
		const at = Math.max(Math.floor(now / 1000), (known[id]?.at ?? 0) + 1);
		await storage.settings.set(DEVICES_KEY, { ...known, [id]: target ? { target, at } : { at } });
	});
	return pushDeviceTags(id, target);
}

/**
 * Chaves e inscrição novas (ao bloquear alguém, ADR-0010): o bloqueado fica com um endereço que não serve mais.
 * `fresh` faz a inscrição nova (no navegador, com a chave VAPID nova; no app nativo, token e par de cifra novos).
 * Sem notificações ativas aqui, nada muda.
 */
export async function renewPushTarget(storage: Storage, fresh: () => Promise<PushTarget>): Promise<string[][] | undefined> {
	if (!(await myPushTarget(storage))) return undefined;
	return setMyPushTarget(storage, await fresh());
}

/**
 * Aviso de outro aparelho meu. `changed`: o meu cartão muda. `unknown`: eu não conhecia esse aparelho, então ele
 * não conhece este; quem tem as notificações ativas se apresenta de volta.
 */
export async function storePushDevice(storage: Storage, me: string, rumor: Rumor): Promise<{ changed: boolean; unknown: boolean }> {
	const none = { changed: false, unknown: false };
	if (rumor.kind !== PUSH_DEVICE_KIND || rumor.pubkey !== me) return none;
	const id = rumor.tags.find((t) => t[0] === DEVICE_TAG)?.[1];
	if (!id || !/^[\w-]{1,32}$/.test(id) || id === (await myDeviceId(storage))) return none;
	const [target] = targetsFromTags(rumor.tags);
	// com a tag mas sem conferir, é um aviso estragado, não um "desativei"
	if (!target && rumor.tags.some((t) => t[0] === PUSH_TAG || t[0] === FCM_TAG)) return none;
	return exclusive(storage, async () => {
		const known = await devices(storage);
		if (known[id] && known[id].at >= rumor.created_at) return none;
		const before = JSON.stringify(await myPushTargets(storage));
		await storage.settings.set(DEVICES_KEY, { ...known, [id]: target ? { target, at: rumor.created_at } : { at: rumor.created_at } });
		return { changed: JSON.stringify(await myPushTargets(storage)) !== before, unknown: !known[id] };
	});
}

/** O serviço de push disse que a inscrição de um contato acabou (404 ou 410): para de mandar para ela. `key`: targetKey. */
export async function dropPushTarget(storage: Storage, publicKey: string, key: string) {
	await exclusive(storage, async () => {
		const card = await storage.profiles.get(publicKey);
		if (!card?.push?.some((t) => targetKey(t) === key)) return;
		const push = card.push.filter((t) => targetKey(t) !== key);
		await storage.profiles.put({ ...card, push: push.length ? push : undefined });
	});
}
