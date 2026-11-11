import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { KdfParams } from '../crypto/seal.ts';
import { createVault, PUSH_DEVICE_KIND } from '../identity/vault.ts';
import { openStorage } from '../storage/repositories.ts';
import { fakeNativeDevice, fakePushDevice } from '../testing/fake-push.ts';
import { dropPushTarget, myDeviceId, myPushTarget, myPushTargets, pushTags, renewPushTarget, setMyPushTarget, storePushDevice, targetsFromTags } from './targets.ts';
import { targetKey } from './webpush.ts';

const FAST: KdfParams = { memoryKiB: 64, iterations: 1, parallelism: 1 };
const closers: Array<() => void> = [];
afterEach(() => closers.splice(0).forEach((c) => c()));

let n = 0;
async function account() {
	const vault = createVault({ kdf: FAST });
	const { publicKey } = await vault.create('123456');
	return { vault, publicKey };
}
function storageFor() {
	const storage = openStorage(`aparelhos-${n++}`);
	closers.push(() => storage.close());
	return storage;
}
type Account = Awaited<ReturnType<typeof account>>;

/** O aviso que um aparelho manda aos outros da mesma conta, como chega a eles. */
function announce(me: Account, tags: string[][], createdAt?: number) {
	return me.vault.unwrap(me.vault.wrapDirectMessage(me.publicKey, '', tags, PUSH_DEVICE_KIND, createdAt).toRecipient);
}

const T0 = Date.UTC(2026, 10, 4);

describe('aparelhos que recebem avisos', () => {
	it('o cartão leva até 3, os mais recentes', async () => {
		const me = await account();
		const phone = storageFor();
		for (let i = 0; i < 4; i++) {
			const other = storageFor();
			const { target } = await fakePushDevice();
			const tags = await setMyPushTarget(other, target, T0 + i * 1000);
			await storePushDevice(phone, me.publicKey, announce(me, tags, (T0 + i * 1000) / 1000));
		}
		const { target } = await fakePushDevice();
		await setMyPushTarget(phone, target, T0 + 10_000);
		const targets = await myPushTargets(phone);
		expect(targets).toHaveLength(3);
		expect(targets[0]).toEqual(target);
		expect(await myPushTarget(phone)).toEqual(target);
	});

	it('aparelho novo conta que é novo; aviso repetido ou mais velho não muda nada', async () => {
		const me = await account();
		const [phone, laptop] = [storageFor(), storageFor()];
		const { target } = await fakePushDevice();
		const tags = await setMyPushTarget(laptop, target, T0);
		const rumor = announce(me, tags, T0 / 1000);
		expect(await storePushDevice(phone, me.publicKey, rumor)).toEqual({ changed: true, unknown: true });
		expect(await storePushDevice(phone, me.publicKey, rumor)).toEqual({ changed: false, unknown: false });
		expect(await myPushTargets(phone)).toEqual([target]);

		// desativou no notebook: sai do cartão, e o aviso antigo que chega atrasado não o traz de volta
		const off = await setMyPushTarget(laptop, undefined, T0 + 60_000);
		expect(await storePushDevice(phone, me.publicKey, announce(me, off, T0 / 1000 + 60))).toEqual({ changed: true, unknown: false });
		expect(await myPushTargets(phone)).toEqual([]);
		expect(await storePushDevice(phone, me.publicKey, rumor)).toEqual({ changed: false, unknown: false });
	});

	it('ignora aviso de outra pessoa, o meu próprio de volta e o estragado', async () => {
		const [me, stranger] = [await account(), await account()];
		const phone = storageFor();
		const { target } = await fakePushDevice();
		const mine = await setMyPushTarget(phone, target, T0);
		expect(await storePushDevice(phone, me.publicKey, announce(me, mine))).toEqual({ changed: false, unknown: false });

		const laptop = storageFor();
		const theirs = await setMyPushTarget(laptop, (await fakePushDevice()).target, T0);
		expect((await storePushDevice(phone, me.publicKey, announce(stranger, theirs))).changed).toBe(false);

		const broken = theirs.map((t) => (t[0] === 'push' ? [...t.slice(0, 3), 'x', ...t.slice(4)] : t));
		expect((await storePushDevice(phone, me.publicKey, announce(me, broken))).changed).toBe(false);
		expect(await myPushTargets(phone)).toEqual([target]);
	});

	it('o id do aparelho fica o mesmo', async () => {
		const storage = storageFor();
		const id = await myDeviceId(storage);
		expect(id).toMatch(/^[\w-]{12}$/);
		expect(await myDeviceId(storage)).toBe(id);
	});
});

describe('chaves novas ao bloquear', () => {
	it('troca a inscrição e o par VAPID deste aparelho', async () => {
		const storage = storageFor();
		const { target } = await fakePushDevice();
		await setMyPushTarget(storage, target, T0);
		const fresh = await fakePushDevice();
		const tags = await renewPushTarget(storage, async () => fresh.target);
		expect(await myPushTarget(storage)).toEqual(fresh.target);
		expect(targetsFromTags(tags!)).toEqual([fresh.target]);
	});

	it('sem notificações ativas aqui, não pede inscrição', async () => {
		const storage = storageFor();
		const tags = await renewPushTarget(storage, () => Promise.reject(new Error('não devia pedir')));
		expect(tags).toBeUndefined();
	});
});

describe('inscrição de contato que acabou', () => {
	it('sai do cartão guardado dele', async () => {
		const storage = storageFor();
		const [a, b] = [await fakePushDevice(), await fakePushDevice()];
		const publicKey = 'f'.repeat(64);
		await storage.profiles.put({ publicKey, name: 'Bia', relays: [], features: [], push: targetsFromTags(pushTags([a.target, b.target])), updatedAt: 1 });
		await dropPushTarget(storage, publicKey, a.target.endpoint);
		expect((await storage.profiles.get(publicKey))?.push).toEqual([b.target]);
		await dropPushTarget(storage, publicKey, b.target.endpoint);
		expect((await storage.profiles.get(publicKey))?.push).toBeUndefined();
	});

	it('o do app nativo sai pelo token', async () => {
		const storage = storageFor();
		const [web, native] = [await fakePushDevice(), await fakeNativeDevice()];
		const publicKey = 'f'.repeat(64);
		await storage.profiles.put({ publicKey, name: 'Bia', relays: [], features: [], push: [web.target, native.target], updatedAt: 1 });
		await dropPushTarget(storage, publicKey, targetKey(native.target));
		expect((await storage.profiles.get(publicKey))?.push).toEqual([web.target]);
	});
});

describe('app nativo (ADR-0011)', () => {
	it('vai no cartão ao lado do navegador e volta igual', async () => {
		const [web, native] = [await fakePushDevice(), await fakeNativeDevice()];
		const tags = pushTags([web.target, native.target]);
		expect(tags[1]).toEqual(['fcm', native.target.fcm, native.target.p256dh, native.target.auth]);
		expect(targetsFromTags(tags)).toEqual([web.target, native.target]);
	});

	it('token ou chave que não confere é descartado', async () => {
		const { target } = await fakeNativeDevice();
		expect(targetsFromTags([['fcm', 'curto', target.p256dh, target.auth]])).toEqual([]);
		expect(targetsFromTags([['fcm', `${target.fcm}/../x`, target.p256dh, target.auth]])).toEqual([]);
		expect(targetsFromTags([['fcm', target.fcm, target.auth, target.auth]])).toEqual([]);
		expect(targetsFromTags([['fcm', target.fcm, target.p256dh]])).toEqual([]);
	});

	it('o aviso entre aparelhos traz o app nativo; estragado não vira "desativei"', async () => {
		const me = await account();
		const [phone, app] = [storageFor(), storageFor()];
		const { target } = await fakeNativeDevice();
		const tags = await setMyPushTarget(app, target, T0);
		expect(await storePushDevice(phone, me.publicKey, announce(me, tags, T0 / 1000))).toEqual({ changed: true, unknown: true });
		expect(await myPushTargets(phone)).toEqual([target]);
		const broken = tags.map((t) => (t[0] === 'fcm' ? ['fcm', 'x', t[2], t[3]] : t));
		expect(await storePushDevice(phone, me.publicKey, announce(me, broken, T0 / 1000 + 60))).toEqual({ changed: false, unknown: false });
		expect(await myPushTargets(phone)).toEqual([target]);
	});
});
