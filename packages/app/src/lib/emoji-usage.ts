// Quantas vezes escolhi cada emoji no seletor (RF-29), no campo e nas reações: os mais usados abrem o seletor e vêm
// primeiro na busca. Preferência do aparelho, como o tamanho da letra; perder não faz falta.
const KEY = 'lerolero:emojis-usados';
const MAX = 200;

export function readEmojiUsage(): Record<string, number> {
	try {
		const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
		if (value && typeof value === 'object') return value as Record<string, number>;
	} catch {
		// armazenamento bloqueado ou estragado: começa do zero
	}
	return {};
}

export function countEmojiUse(emoji: string) {
	const usage = readEmojiUsage();
	usage[emoji] = (usage[emoji] ?? 0) + 1;
	// guarda só os mais usados, para a lista não crescer sem fim
	const kept = Object.entries(usage)
		.sort((a, b) => b[1] - a[1])
		.slice(0, MAX);
	try {
		localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(kept)));
	} catch {
		// vale só até fechar o app
	}
}

/** Os emojis mais usados, do mais para o menos. */
export const mostUsed = (usage: Record<string, number>, limit: number) =>
	Object.entries(usage)
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit)
		.map(([emoji]) => emoji);
