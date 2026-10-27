import { describe, expect, it } from 'vitest';
import { connect, expose, RemoteError } from './rpc.ts';

class Failure extends Error {
	override name = 'Failure';
}

class Detailed extends Error {
	override name = 'Detailed';
	constructor(readonly detail: unknown) {
		super('com código');
	}
}

const handlers = {
	soma: (a: number, b: number) => a + b,
	devagar: async (x: string) => x.toUpperCase(),
	bytes: (b: Uint8Array) => b.length,
	falha: () => {
		throw new Failure('deu errado');
	},
	detalhada: () => {
		throw new Detailed({ reason: 'palavra', position: 3 });
	}
};

function pair() {
	const { port1, port2 } = new MessageChannel();
	expose(handlers, port1 as never);
	const remote = connect<typeof handlers>(port2 as never);
	port1.start();
	port2.start();
	return { remote, close: () => (port1.close(), port2.close()) };
}

describe('RPC com o worker', () => {
	it('chama funções síncronas e assíncronas e devolve o resultado', async () => {
		const { remote, close } = pair();
		expect(await remote.soma(2, 3)).toBe(5);
		expect(await remote.devagar('oi')).toBe('OI');
		expect(await remote.bytes(new Uint8Array(7))).toBe(7);
		close();
	});

	it('repassa o erro com o nome original', async () => {
		const { remote, close } = pair();
		const err = await remote.falha().catch((e) => e);
		expect(err).toBeInstanceOf(RemoteError);
		expect(err.name).toBe('Failure');
		expect(err.message).toBe('deu errado');
		expect(err.detail).toBeUndefined();
		close();
	});

	it('repassa o código do problema, para a interface traduzir (ADR-0008)', async () => {
		const { remote, close } = pair();
		const err = await remote.detalhada().catch((e) => e);
		expect(err).toMatchObject({ name: 'Detailed', message: 'com código', detail: { reason: 'palavra', position: 3 } });
		close();
	});
});
