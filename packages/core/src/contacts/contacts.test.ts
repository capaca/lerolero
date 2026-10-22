import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { npubEncode, nprofileEncode } from 'nostr-tools/nip19';
import { openStorage, type Storage } from '../storage/repositories.ts';
import { addContact, contactName, listContacts, renameContact, SelfInviteError } from './contacts.ts';
import { cleanName, InvalidInviteError, inviteLink, parseInvite } from './invite.ts';

const APP = 'https://capaca.github.io/lerolero/';
const key = () => getPublicKey(generateSecretKey());

describe('convite', () => {
	it('vai e volta pelo link, com nome acentuado e relays', () => {
		const invite = { publicKey: key(), name: 'Conceição Araújo', relays: ['wss://a.example', 'wss://b.example'] };
		const link = inviteLink(APP, invite);
		expect(link.startsWith(`${APP}convite#nprofile1`)).toBe(true);
		expect(parseInvite(link)).toEqual(invite);
	});

	it('aceita nprofile e npub de outros apps Nostr, com ou sem "nostr:"', () => {
		const publicKey = key();
		expect(parseInvite(`nostr:${nprofileEncode({ pubkey: publicKey, relays: ['wss://r.example'] })}`)).toEqual({
			publicKey,
			relays: ['wss://r.example']
		});
		expect(parseInvite(npubEncode(publicKey))).toEqual({ publicKey, relays: [] });
	});

	it('descarta relays que não são wss e limita a 3', () => {
		const publicKey = key();
		const code = nprofileEncode({
			pubkey: publicKey,
			relays: ['ws://inseguro.example', 'wss://1.x', 'wss://2.x', 'wss://3.x', 'wss://4.x']
		});
		expect(parseInvite(code).relays).toEqual(['wss://1.x', 'wss://2.x', 'wss://3.x']);
	});

	it('limpa nomes estranhos', () => {
		expect(cleanName('  Maria​‮  da\n Silva ')).toBe('Maria da Silva');
		expect(cleanName('x'.repeat(100))).toHaveLength(40);
	});

	it('recusa o que não é convite de pessoa', () => {
		expect(() => parseInvite('https://exemplo.com')).toThrow(InvalidInviteError);
		expect(() => parseInvite('nsec1qqqqqq')).toThrow(InvalidInviteError);
	});
});

describe('contatos', () => {
	let storage: Storage;
	let n = 0;
	const me = key();
	beforeEach(() => {
		storage = openStorage(`contatos-${n++}`);
	});
	afterEach(() => storage.close());

	it('o nome local prevalece sobre o escolhido pelo contato (RF-14)', async () => {
		const c = await addContact(storage.contacts, { publicKey: key(), name: 'Mãe', relays: [] }, { myPublicKey: me, localName: 'Golpista?' });
		expect(contactName(c)).toBe('Golpista?');
		expect(c.chosenName).toBe('Mãe');
	});

	it('sem nome local, usa o escolhido; sem nenhum, o começo da chave', async () => {
		const a = await addContact(storage.contacts, { publicKey: key(), name: 'Ana', relays: [] }, { myPublicKey: me });
		const b = await addContact(storage.contacts, { publicKey: key(), relays: [] }, { myPublicKey: me });
		expect(contactName(a)).toBe('Ana');
		expect(contactName(b)).toMatch(/^npub1.{7}…$/);
	});

	it('readicionar atualiza os relays e mantém o nome local', async () => {
		const publicKey = key();
		await addContact(storage.contacts, { publicKey, relays: ['wss://velho.x'] }, { myPublicKey: me, localName: 'Zé' });
		const again = await addContact(storage.contacts, { publicKey, name: 'José', relays: ['wss://novo.x'] }, { myPublicKey: me });
		expect(again.localName).toBe('Zé');
		expect(again.chosenName).toBe('José');
		expect(again.dmRelays).toEqual(['wss://novo.x']);
	});

	it('não deixa adicionar a si mesmo', async () => {
		await expect(addContact(storage.contacts, { publicKey: me, relays: [] }, { myPublicKey: me })).rejects.toBeInstanceOf(SelfInviteError);
	});

	it('renomeia e lista em ordem alfabética, sem os bloqueados', async () => {
		const a = await addContact(storage.contacts, { publicKey: key(), name: 'bruno', relays: [] }, { myPublicKey: me });
		await addContact(storage.contacts, { publicKey: key(), name: 'Álvaro', relays: [] }, { myPublicKey: me });
		await storage.contacts.put({ ...a, publicKey: key(), state: 'bloqueado', localName: 'Aaa bloqueado' });
		await renameContact(storage.contacts, a.publicKey, 'Carlos');
		expect((await listContacts(storage.contacts)).map(contactName)).toEqual(['Álvaro', 'Carlos']);
	});
});
