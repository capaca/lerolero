import { describe, expect, it } from 'vitest';
import { seal, unseal, WrongPinError, type KdfParams } from './seal.ts';

// parâmetros baixos só para o teste ser rápido; o app usa DEFAULT_KDF
const FAST: KdfParams = { memoryKiB: 64, iterations: 1, parallelism: 1 };
const secret = new TextEncoder().encode('frase de recuperação de teste');

describe('lacre com PIN', () => {
	it('abre com o PIN certo', async () => {
		const sealed = await seal(secret, '123456', FAST);
		expect(await unseal(sealed, '123456')).toEqual(secret);
	});

	it('recusa o PIN errado', async () => {
		const sealed = await seal(secret, '123456', FAST);
		await expect(unseal(sealed, '654321')).rejects.toBeInstanceOf(WrongPinError);
	});

	it('usa sal e IV novos a cada lacre', async () => {
		const a = await seal(secret, '123456', FAST);
		const b = await seal(secret, '123456', FAST);
		expect(a.salt).not.toEqual(b.salt);
		expect(a.iv).not.toEqual(b.iv);
		expect(a.ciphertext).not.toEqual(b.ciphertext);
	});

	it('guarda os parâmetros do Argon2id junto com o lacre', async () => {
		expect((await seal(secret, '123456', FAST)).kdf).toEqual(FAST);
	});
});
