// Faixa de avisos (P9): o que o Pedro precisa dizer a todos num incidente (versão ruim, relay fora do ar). Vem do
// GitHub, não dos relays, que podem ser o que quebrou. A última lista baixada fica guardada, para o aviso continuar
// na tela sem internet ou com o banco quebrado (tela de erro do P8). Preferências do aparelho, não da conta.
import { currentAnnouncement, parseAnnouncements, type Announcement } from '@lerolero/core';

const LIST_KEY = 'lerolero:avisos';
const DISMISSED_KEY = 'lerolero:avisos-fechados';

function read(key: string): unknown {
	try {
		return JSON.parse(localStorage.getItem(key) ?? 'null');
	} catch {
		return null; // armazenamento bloqueado ou estragado: começa sem nada
	}
}

function write(key: string, value: unknown) {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// vale só até fechar o app
	}
}

class Announcements {
	#list = $state<Announcement[]>(parseAnnouncements(read(LIST_KEY)));
	#dismissed = $state<string[]>(((d) => (Array.isArray(d) ? d.filter((id) => typeof id === 'string') : []))(read(DISMISSED_KEY)));
	#now = $state(Date.now());

	readonly current = $derived(currentAnnouncement(this.#list, this.#now, this.#dismissed));

	/** Busca a lista de novo; sem rede ou com o GitHub fora, fica a última que veio. */
	async refresh() {
		this.#now = Date.now();
		let input: unknown;
		try {
			const res = await fetch(__APP_AVISOS__, { cache: 'no-cache' });
			// 404: o arquivo ainda não existe (nenhum aviso publicado), o mesmo que a lista vazia
			if (res.status === 404) input = { versao: 1, avisos: [] };
			else if (res.ok) input = await res.json();
			else return;
		} catch {
			return;
		}
		this.#list = parseAnnouncements(input);
		write(LIST_KEY, { versao: 1, avisos: this.#list });
		// os fechados que saíram do arquivo não voltam: a lista guardada não cresce para sempre
		this.#dismissed = this.#dismissed.filter((id) => this.#list.some((a) => a.id === id));
		write(DISMISSED_KEY, this.#dismissed);
	}

	dismiss(id: string) {
		this.#dismissed = [...this.#dismissed, id];
		write(DISMISSED_KEY, this.#dismissed);
	}
}

export const announcements = new Announcements();
