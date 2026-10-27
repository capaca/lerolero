// Datas e horas como as pessoas falam: "14:32", "Ontem", "segunda-feira", "3 de out.",
// na localidade da interface (RNF-72, ADR-0008).

import { intlLocale } from '#lib/i18n.svelte.ts';
import { m } from '#lib/paraglide/messages.js';

const STYLES = {
	time: { hour: '2-digit', minute: '2-digit' },
	weekday: { weekday: 'long' },
	dayMonth: { day: 'numeric', month: 'short' },
	full: { day: 'numeric', month: 'long', year: 'numeric' }
} satisfies Record<string, Intl.DateTimeFormatOptions>;

// criar o formatador custa; um por estilo e língua
const cache = new Map<string, Intl.DateTimeFormat>();
function format(style: keyof typeof STYLES, date: Date | number): string {
	const key = `${intlLocale()} ${style}`;
	let f = cache.get(key);
	if (!f) cache.set(key, (f = new Intl.DateTimeFormat(intlLocale(), STYLES[style])));
	return f.format(date);
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const DAY = 24 * 60 * 60 * 1000;

export const formatTime = (seconds: number) => format('time', seconds * 1000);

/** Separador de dia na conversa. */
export function formatDay(seconds: number, now = new Date()): string {
	const date = new Date(seconds * 1000);
	const diff = (startOfDay(now) - startOfDay(date)) / DAY;
	if (diff === 0) return m.data_hoje();
	if (diff === 1) return m.data_ontem();
	if (diff < 7) return format('weekday', date);
	return format('full', date);
}

/** Horário curto na lista de conversas. */
export function formatWhen(seconds: number, now = new Date()): string {
	const date = new Date(seconds * 1000);
	const diff = (startOfDay(now) - startOfDay(date)) / DAY;
	if (diff === 0) return formatTime(seconds);
	if (diff === 1) return m.data_ontem();
	if (diff < 7) return format('weekday', date);
	return format('dayMonth', date);
}

/** Um dia escrito como AAAA-MM-DD (ex.: a data da lista de relays), por extenso. */
export function formatIsoDay(iso: string): string {
	const [year, month, day] = iso.split('-').map(Number);
	return format('full', new Date(year!, month! - 1, day));
}

export const dayKey =(seconds: number) => startOfDay(new Date(seconds * 1000));
