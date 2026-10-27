// RPC mínimo entre a thread principal e um Web Worker: o worker expõe um objeto
// de funções e a thread principal chama como se fossem locais, recebendo Promises.
// Fica no núcleo, independente de plataforma: quem cria o Worker é o app.

type Handlers = Record<string, (...args: any[]) => unknown>;

export type Remote<H extends Handlers> = {
	[K in keyof H]: (...args: Parameters<H[K]>) => Promise<Awaited<ReturnType<H[K]>>>;
};

type Request = { id: number; method: string; args: unknown[] };
type RemoteErrorData = { name: string; message: string; detail?: unknown };
type Response = { id: number; ok: true; value: unknown } | { id: number; ok: false; error: RemoteErrorData };

/** As duas pontas só precisam de postMessage e de ouvir mensagens (Worker, MessagePort, self do worker). */
export type Endpoint = {
	postMessage(message: unknown): void;
	addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
};

/** Lado do worker. */
export function expose(handlers: Handlers, endpoint: Endpoint) {
	endpoint.addEventListener('message', async (event) => {
		const { id, method, args } = event.data as Request;
		let response: Response;
		try {
			const handler = handlers[method];
			if (!handler) throw new Error(`método desconhecido no worker: ${method}`);
			response = { id, ok: true, value: await handler(...args) };
		} catch (err) {
			const e = err instanceof Error ? err : new Error(String(err));
			// `detail` leva o código do problema (ex.: qual palavra da frase): a interface traduz (ADR-0008)
			const detail = (e as { detail?: unknown }).detail;
			response = { id, ok: false, error: { name: e.name, message: e.message, ...(detail === undefined ? {} : { detail }) } };
		}
		endpoint.postMessage(response);
	});
}

/** Erro vindo do worker, com o nome original (ex.: WrongPinError) para quem chamou poder distinguir. */
export class RemoteError extends Error {
	constructor(
		name: string,
		message: string,
		readonly detail?: unknown
	) {
		super(message);
		this.name = name;
	}
}

/** Lado da thread principal. */
export function connect<H extends Handlers>(endpoint: Endpoint): Remote<H> {
	let nextId = 1;
	const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
	endpoint.addEventListener('message', (event) => {
		const response = event.data as Response;
		const p = pending.get(response.id);
		if (!p) return;
		pending.delete(response.id);
		if (response.ok) p.resolve(response.value);
		else p.reject(new RemoteError(response.error.name, response.error.message, response.error.detail));
	});
	return new Proxy({} as Remote<H>, {
		get: (_, method) => {
			if (typeof method !== 'string' || method === 'then') return undefined;
			return (...args: unknown[]) =>
				new Promise((resolve, reject) => {
					const id = nextId++;
					pending.set(id, { resolve, reject });
					endpoint.postMessage({ id, method, args } satisfies Request);
				});
		}
	});
}
