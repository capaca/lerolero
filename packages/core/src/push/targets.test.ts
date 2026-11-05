import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { KdfParams } from '../crypto/seal.ts';
import { createVault, PUSH_DEVICE_KIND } from '../identity/vault.ts';
import { openStorage } from '../storage/repositories.ts';
import { fakePushDevice } from '../testing/fake-push.ts';
import { dropPushTarget, myDeviceId, myPushTarget, myPushTargets, pushTags, renewPushTarget, setMyPushTarget, storePushDevice, targetsFromTags } from './targets.ts';

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
		let asked = '';
		const tags = await renewPushTarget(storage, async (vapidPublicKey) => {
			asked = vapidPublicKey;
			return { endpoint: fresh.target.endpoint, p256dh: fresh.target.p256dh, auth: fresh.target.auth };
		});
		const renewed = (await myPushTarget(storage))!;
		expect(renewed.endpoint).toBe(fresh.target.endpoint);
		expect(renewed.vapid.publicKey).toBe(asked);
		expect(renewed.vapid.publicKey).not.toBe(target.vapid.publicKey);
		expect(targetsFromTags(tags!)).toEqual([renewed]);
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
});
