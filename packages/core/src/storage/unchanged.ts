// A tela recarrega a conversa do banco a cada mudança, e o banco devolve objetos novos mesmo para o que não mudou.
// Reaproveitar o objeto anterior quando o conteúdo é igual deixa o Svelte redesenhar só o balão que mudou (P17).

/** Mesmo conteúdo: campos iguais, com os objetos de dentro (mídia, confirmações, rumor) comparados pelo JSON. */
export function sameRecord(a: object, b: object): boolean {
	if (a === b) return true;
	const x = a as Record<string, unknown>;
	const y = b as Record<string, unknown>;
	const keys = Object.keys(x);
	if (keys.length !== Object.keys(y).length) return false;
	for (const key of keys) {
		if (!(key in y)) return false;
		const p = x[key];
		const q = y[key];
		if (p === q) continue;
		if (typeof p !== 'object' || typeof q !== 'object' || p === null || q === null) return false;
		if (JSON.stringify(p) !== JSON.stringify(q)) return false;
	}
	return true;
}

/** A lista nova com os objetos de `previous` no lugar dos que não mudaram (pelo id). */
export function keepUnchanged<T extends { id: string }>(previous: readonly T[], next: T[]): T[] {
	if (!previous.length) return next;
	const old = new Map(previous.map((item) => [item.id, item]));
	return next.map((item) => {
		const before = old.get(item.id);
		return before && sameRecord(before, item) ? before : item;
	});
}

/** O mesmo para listas por chave (ex.: as reações de cada mensagem): a lista anterior fica se nada nela mudou. */
export function keepUnchangedGroups<T extends { id: string }>(previous: ReadonlyMap<string, T[]>, next: Map<string, T[]>): Map<string, T[]> {
	for (const [key, list] of next) {
		const before = previous.get(key);
		if (before && before.length === list.length && list.every((item, i) => sameRecord(before[i], item))) next.set(key, before);
	}
	return next;
}

/** A ordem do banco (repositories.ts, índice [conversationId+createdAt]): horário e, no empate, o id. */
const byDbOrder = (a: { createdAt: number; id: string }, b: { createdAt: number; id: string }) =>
	a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * A janela de mensagens da tela com só as que mudaram relidas do banco, sem ler a página inteira (P17: numa rajada,
 * reler 200 mensagens a cada uma que chegava atrasava o recebimento). `changed` traz o que o banco tem agora para
 * cada id: as que sumiram ou são de outra conversa saem; as que mudaram ficam no lugar; as novas entram na ordem do
 * banco, menos as mais antigas que a primeira da janela, que ficam para "carregar anteriores" (`older`). Passou do
 * `limit`, as mais antigas saem da janela.
 */
export function applyChanges<T extends { id: string; conversationId: string; createdAt: number }>(
	window: readonly T[],
	changed: ReadonlyArray<readonly [string, T | undefined]>,
	conversationId: string,
	limit: number
): { list: T[]; older: boolean } {
	const byId = new Map(window.map((item) => [item.id, item]));
	const first = window[0];
	let older = false;
	let added = false;
	for (const [id, item] of changed) {
		if (!item || item.conversationId !== conversationId) byId.delete(id);
		else if (byId.has(id)) byId.set(id, item);
		else if (first && byDbOrder(item, first) < 0) older = true;
		else {
			byId.set(id, item);
			added = true;
		}
	}
	let list = [...byId.values()];
	if (added) list.sort(byDbOrder);
	if (list.length > limit) {
		list = list.slice(list.length - limit);
		older = true;
	}
	return { list, older };
}

/**
 * A página antes da primeira da janela, a partir do que o banco devolveu até o segundo dela (inclusive: no mesmo
 * segundo, quem vem antes é decidido pelo id). Devolve até `size` mensagens, as mais próximas da janela, e se ainda
 * há mais antigas.
 */
export function olderPage<T extends { id: string; createdAt: number }>(read: readonly T[], first: T, size: number): { page: T[]; more: boolean } {
	const before = read.filter((item) => byDbOrder(item, first) < 0);
	return { page: before.slice(Math.max(0, before.length - size)), more: before.length > size };
}
