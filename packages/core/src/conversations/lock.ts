// Uma gravação de conversa por vez em cada banco. Guardar uma mensagem ou um aviso de grupo lê a conversa, muda e
// grava de volta; com duas ao mesmo tempo (um aviso que chega pela rede e uma ação da pessoa na tela) a mais lenta
// apagava a mudança da outra. Visto no e2e de grupos: promover alguém logo depois de adicionar membros perdia a
// promoção, porque a apresentação de quem acabou de entrar chegava no meio.

import type { Storage } from '../storage/repositories.ts';

const tails = new WeakMap<Storage, Promise<unknown>>();

/** Roda `fn` depois de tudo o que já pediu a vez neste banco. Não chame uma função com vez dentro de outra. */
export function exclusive<T>(storage: Storage, fn: () => Promise<T>): Promise<T> {
	const run = (tails.get(storage) ?? Promise.resolve()).then(fn, fn);
	tails.set(storage, run.catch(() => undefined));
	return run;
}
