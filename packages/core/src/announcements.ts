// Faixa de avisos para quem testa (P9): o avisos.json fica no branch `avisos` do repositório, gravado pelo workflow
// avisos.yml, para o Pedro falar com todos num incidente sem release nova e sem depender dos relays.
// Vem de fora do app, então tudo é validado, e o texto é só texto: nunca HTML nem link (T27).

export type AnnouncementLevel = 'info' | 'problema';

export type Announcement = {
	/** identifica o aviso para "Fechar" valer só para ele */
	id: string;
	nivel: AnnouncementLevel;
	texto: string;
	/** quando o aviso some sozinho (ISO 8601) */
	ate: string;
};

/** Cabe em duas ou três linhas no celular, sem cobrir a tela. */
export const ANNOUNCEMENT_MAX_LENGTH = 280;

const LEVELS: readonly string[] = ['info', 'problema'] satisfies AnnouncementLevel[];

/** Os avisos válidos do arquivo; um aviso errado é ignorado sem derrubar os outros. */
export function parseAnnouncements(input: unknown): Announcement[] {
	if (typeof input !== 'object' || input === null) return [];
	const { versao, avisos } = input as Record<string, unknown>;
	if (versao !== 1 || !Array.isArray(avisos)) return [];
	return avisos.flatMap((item): Announcement[] => {
		if (typeof item !== 'object' || item === null) return [];
		const { id, nivel, texto, ate } = item as Record<string, unknown>;
		if (typeof id !== 'string' || !id || typeof nivel !== 'string' || !LEVELS.includes(nivel)) return [];
		if (typeof texto !== 'string' || typeof ate !== 'string' || Number.isNaN(Date.parse(ate))) return [];
		const text = texto.trim();
		if (!text || text.length > ANNOUNCEMENT_MAX_LENGTH) return [];
		return [{ id, nivel: nivel as AnnouncementLevel, texto: text, ate }];
	});
}

/** O aviso a mostrar agora: um por vez, o de problema antes, e nunca um vencido ou fechado neste aparelho. */
export function currentAnnouncement(list: Announcement[], now: number, dismissed: readonly string[]): Announcement | undefined {
	const open = list.filter((a) => Date.parse(a.ate) > now && !dismissed.includes(a.id));
	return open.find((a) => a.nivel === 'problema') ?? open[0];
}
