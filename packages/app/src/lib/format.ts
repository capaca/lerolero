// Datas e horas como as pessoas falam: "14:32", "Ontem", "segunda-feira", "3 de out.".

const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' });
const dayMonth = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
const full = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const DAY = 24 * 60 * 60 * 1000;

export const formatTime = (seconds: number) => time.format(seconds * 1000);

/** Separador de dia na conversa. */
export function formatDay(seconds: number, now = new Date()): string {
	const date = new Date(seconds * 1000);
	const diff = (startOfDay(now) - startOfDay(date)) / DAY;
	if (diff === 0) return 'Hoje';
	if (diff === 1) return 'Ontem';
	if (diff < 7) return weekday.format(date);
	return full.format(date);
}

/** Horário curto na lista de conversas. */
export function formatWhen(seconds: number, now = new Date()): string {
	const date = new Date(seconds * 1000);
	const diff = (startOfDay(now) - startOfDay(date)) / DAY;
	if (diff === 0) return formatTime(seconds);
	if (diff === 1) return 'Ontem';
	if (diff < 7) return weekday.format(date);
	return dayMonth.format(date);
}

export const dayKey = (seconds: number) => startOfDay(new Date(seconds * 1000));
