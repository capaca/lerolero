import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { KdfParams } from '../crypto/seal.ts';
import { createVault, PROFILE_KIND } from '../identity/vault.ts';
import { directConversationId, storeOutgoing } from '../conversations/messaging.ts';
import { openStorage } from '../storage/repositories.ts';
import type { ConversationRecord, MessageMedia } from '../storage/records.ts';
import {
	markProfileSent,
	photoAllowed,
	PROFILE_FEATURES,
	profileAudience,
	profileDue,
	profileEvent,
	profileFromRumor,
	storeProfile
} from './profile.ts';

const FAST: KdfParams = { memoryKiB: 64, iterations: 1, parallelism: 1 };
const closers: Array<() => void> = [];
afterEach(() => closers.splice(0).forEach((c) => c()));

let n = 0;
async function device() {
	const vault = createVault({ kdf: FAST });
	const { publicKey } = await vault.create('123456');
	const storage = openStorage(`perfil-${n++}`);
	closers.push(() => storage.close());
	return { vault, publicKey, storage };
}
type Person = Awaited<ReturnType<typeof device>>;

const PHOTO: MessageMedia = {
	ox: 'a'.repeat(64),
	x: 'b'.repeat(64),
	type: 'image/jpeg',
	size: 30_000,
	urls: ['https://blossom.example/' + 'b'.repeat(64)],
	key: 'c'.repeat(64),
	nonce: 'd'.repeat(24),
	width: 512,
	height: 512,
	thumb: 'AAAA'
};

/** O cartão de `from` como chega a `to`. */
function card(from: Person, to: Person, fields: { name: string; photo?: MessageMedia; relays?: string[] }, createdAt?: number) {
	const { content, tags } = profileEvent({ relays: [], app: '0.8.0', features: PROFILE_FEATURES, ...fields });
	return to.vault.unwrap(from.vault.wrapDirectMessage(to.publicKey, content, tags, PROFILE_KIND, createdAt).toRecipient);
}

function groupWith(members: string[]): ConversationRecord {
	return {
		id: 'grupo:abc',
		type: 'grupo',
		members,
		lastMessageAt: 1,
		unread: 0,
		group: { state: { name: 'Família', members: [], admins: [], creator: members[0]! }, names: {}, everMembers: members, amMember: true }
	};
}

describe('cartão de perfil (Q-P5)', () => {
	it('leva nome, foto, relays e versão, e quem recebe lê tudo de volta', async () => {
		const alice = await device();
		const bob = await device();
		const got = profileFromRumor(card(alice, bob, { name: 'Alice', photo: PHOTO, relays: ['wss://relay.example'] }));
		expect(got).toMatchObject({ publicKey: alice.publicKey, name: 'Alice', photo: PHOTO, relays: ['wss://relay.example'], app: '0.8.0' });
		expect(got?.features).toEqual(PROFILE_FEATURES);
	});

	it('o cofre não embrulha cartão sem nome', async () => {
		const alice = await device();
		const bob = await device();
		expect(() => alice.vault.wrapDirectMessage(bob.publicKey, '', [['v', '1']], PROFILE_KIND)).toThrow();
	});

	it('dado de fora é conferido: relay que não é wss, foto que não é imagem e versão estranha ficam de fora', async () => {
		const alice = await device();
		const bob = await device();
		const tags = [
			['nome', 'Alice'],
			['relay', 'http://relay.example'],
			['app', '<script>'],
			['recurso', 'MUITO LONGO E ESTRANHO'],
			...profileEvent({ name: 'x', relays: [], features: [], photo: { ...PHOTO, type: 'text/html' } }).tags.filter((t) => t[0] !== 'nome')
		];
		const rumor = bob.vault.unwrap(alice.vault.wrapDirectMessage(bob.publicKey, PHOTO.urls[0]!, tags, PROFILE_KIND).toRecipient);
		const got = profileFromRumor(rumor);
		expect(got).toMatchObject({ name: 'Alice', relays: [], features: [] });
		expect(got?.photo).toBeUndefined();
		expect(got?.app).toBeUndefined();
	});

	it('o nome do cartão vira o escolhido pelo contato; o nome que eu dei continua valendo (RF-14)', async () => {
		const alice = await device();
		const bob = await device();
		await bob.storage.contacts.put({ publicKey: alice.publicKey, localName: 'Mãe', chosenName: 'Alice', state: 'aceito', dmRelays: [], addedAt: 1 });
		await storeProfile(bob.storage, bob.publicKey, card(alice, bob, { name: 'Alice Souza', relays: ['wss://novo.example'] }));
		expect(await bob.storage.contacts.get(alice.publicKey)).toMatchObject({
			localName: 'Mãe',
			chosenName: 'Alice Souza',
			dmRelays: ['wss://novo.example']
		});
	});

	it('um cartão mais velho que chega depois não desfaz o mais novo', async () => {
		const alice = await device();
		const bob = await device();
		await storeProfile(bob.storage, bob.publicKey, card(alice, bob, { name: 'Alice Souza' }, 2000));
		expect(await storeProfile(bob.storage, bob.publicKey, card(alice, bob, { name: 'Alice' }, 1000))).toBeUndefined();
		expect((await bob.storage.profiles.get(alice.publicKey))?.name).toBe('Alice Souza');
	});

	it('o nome do cartão chega aos grupos em que a pessoa está', async () => {
		const alice = await device();
		const bob = await device();
		await bob.storage.conversations.put(groupWith([alice.publicKey]));
		await storeProfile(bob.storage, bob.publicKey, card(alice, bob, { name: 'Alice Souza' }));
		expect((await bob.storage.conversations.get('grupo:abc'))?.group?.names[alice.publicKey]).toBe('Alice Souza');
	});

	it('de desconhecido o cartão só fica guardado: não vira pedido de mensagem (T7); de bloqueado, descartado', async () => {
		const alice = await device();
		const bob = await device();
		const carol = await device();
		await storeProfile(bob.storage, bob.publicKey, card(alice, bob, { name: 'Alice' }));
		expect(await bob.storage.contacts.get(alice.publicKey)).toBeUndefined();
		expect(await bob.storage.profiles.get(alice.publicKey)).toBeDefined();

		await bob.storage.contacts.put({ publicKey: carol.publicKey, state: 'bloqueado', dmRelays: [], addedAt: 1 });
		await storeProfile(bob.storage, bob.publicKey, card(carol, bob, { name: 'Carol' }));
		expect(await bob.storage.profiles.get(carol.publicKey)).toBeUndefined();
	});

	it('a foto aparece para contato aceito e quem está num grupo comigo; de pedido, não (T9)', async () => {
		const bob = await device();
		const [aceito, pedido, colega, estranho] = ['1', '2', '3', '4'].map((c) => c.repeat(64));
		await bob.storage.contacts.put({ publicKey: aceito!, state: 'aceito', dmRelays: [], addedAt: 1 });
		await bob.storage.contacts.put({ publicKey: pedido!, state: 'pedido', dmRelays: [], addedAt: 1 });
		await bob.storage.conversations.put(groupWith([colega!]));
		expect(await photoAllowed(bob.storage, bob.publicKey, aceito!)).toBe(true);
		expect(await photoAllowed(bob.storage, bob.publicKey, pedido!)).toBe(false);
		expect(await photoAllowed(bob.storage, bob.publicKey, colega!)).toBe(true);
		expect(await photoAllowed(bob.storage, bob.publicKey, estranho!)).toBe(false);
	});

	it('quando o cartão muda, vai para quem já conversou comigo, menos pedidos e bloqueados', async () => {
		const alice = await device();
		const bob = (await device()).publicKey;
		const [carol, dave, eve] = ['2', '3', '4'].map((c) => c.repeat(64));
		// falei com Bob no 1:1
		const w = alice.vault.wrapDirectMessage(bob, 'oi', [['nome', 'Alice']]);
		await storeOutgoing(alice.storage, w.rumor, bob);
		await alice.storage.contacts.put({ publicKey: bob, state: 'aceito', dmRelays: [], addedAt: 1 });
		// Carol está num grupo comigo, sem ser contato
		await alice.storage.conversations.put(groupWith([carol!]));
		// Dave só mandou pedido (a conversa existe, mas eu nunca escrevi)
		await alice.storage.contacts.put({ publicKey: dave!, state: 'pedido', dmRelays: [], addedAt: 1 });
		await alice.storage.conversations.put({ id: directConversationId(dave!), type: 'direta', members: [dave!], lastMessageAt: 1, unread: 1 });
		// Eve recebeu o cartão antes e depois foi bloqueada
		await markProfileSent(alice.storage, [eve!], 1);
		await alice.storage.contacts.put({ publicKey: eve!, state: 'bloqueado', dmRelays: [], addedAt: 1 });

		expect((await profileAudience(alice.storage, alice.publicKey)).sort()).toEqual([bob, carol!].sort());
	});

	it('o cartão sai uma vez por versão para cada pessoa', async () => {
		const alice = await device();
		const bob = '1'.repeat(64);
		expect(await profileDue(alice.storage, [bob], 100)).toEqual([bob]);
		await markProfileSent(alice.storage, [bob], 100);
		expect(await profileDue(alice.storage, [bob], 100)).toEqual([]);
		expect(await profileDue(alice.storage, [bob], 200)).toEqual([bob]);
	});
});
