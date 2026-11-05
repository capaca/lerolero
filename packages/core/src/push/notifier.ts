// Manda o aviso de "mensagem nova" (ADR-0010, RF-82) depois que a mensagem chegou a um relay: quem recebe acorda e
// já acha a mensagem. Uma rajada de mensagens para a mesma pessoa vira dois avisos (o primeiro na hora e um no fim
// da janela), o que poupa o limite do repassador e a bateria de quem recebe.

import type { Storage } from '../storage/repositories.ts';
import { cleanName } from '../contacts/invite.ts';
import { dropPushTarget } from './targets.ts';
import { pushRequest } from './webpush.ts';

/** Depois de um aviso, os outros para a mesma pessoa esperam isto e saem juntos num só. */
export const PUSH_BURST_MS = 15_000;

/**
 * O que o aviso leva, cifrado para o aparelho (só ele abre): quem mandou e, em grupo, qual. Nunca o conteúdo (T6).
 * O service worker mostra o nome que conhece para essa chave e, sem ele, o que veio aqui.
 */
export type PushPayload = { v: 1; de: string; nome: string; grupo?: string };

export type PushNotifierOptions = {
	storage: Storage;
	/** endereço do repassador (o da produção ou o da homologação) */
	relay: string;
	me: string;
	myName: () => string;
	fetch?: typeof fetch;
	now?: () => number;
};

type Pending = { timer?: ReturnType<typeof setTimeout>; lastAt: number; grupo?: string; waiting: boolean };

export class PushNotifier {
	private readonly pending = new Map<string, Pending>();
	private readonly fetch: typeof fetch;
	private readonly now: () => number;

	constructor(private readonly options: PushNotifierOptions) {
		this.fetch = options.fetch ?? ((...args) => fetch(...args));
		this.now = options.now ?? Date.now;
	}

	/** Uma mensagem para `recipient` chegou a um relay; `grupo` é o id do grupo, se for de grupo. */
	notify(recipient: string, grupo?: string) {
		if (recipient === this.options.me) return;
		const state = this.pending.get(recipient);
		const now = this.now();
		if (!state || now - state.lastAt >= PUSH_BURST_MS) {
			this.pending.set(recipient, { lastAt: now, waiting: false });
			void this.send(recipient, grupo);
			return;
		}
		state.grupo = grupo;
		if (state.waiting) return;
		state.waiting = true;
		state.timer = setTimeout(() => {
			state.waiting = false;
			state.lastAt = this.now();
			void this.send(recipient, state.grupo);
		}, PUSH_BURST_MS - (now - state.lastAt));
	}

	/** Ao sair da conta: o que estava esperando não sai mais. */
	stop() {
		for (const state of this.pending.values()) clearTimeout(state.timer);
		this.pending.clear();
	}

	/** Um aviso a cada aparelho da pessoa; falha aqui não muda nada na conversa (a mensagem já está nos relays). */
	private async send(recipient: string, grupo?: string) {
		const { storage, relay } = this.options;
		try {
			if ((await storage.contacts.get(recipient))?.state === 'bloqueado') return;
			const targets = (await storage.profiles.get(recipient))?.push ?? [];
			const payload: PushPayload = { v: 1, de: this.options.me, nome: cleanName(this.options.myName()), ...(grupo ? { grupo } : {}) };
			await Promise.all(
				targets.map(async (target) => {
					const request = await pushRequest(target, payload, this.now());
					const res = await this.fetch(relay, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
					if (!res.ok) return;
					const { status } = (await res.json()) as { status?: number };
					// a pessoa desativou ou trocou as chaves (bloqueou alguém): o cartão novo traz o endereço novo
					if (status === 404 || status === 410) await dropPushTarget(storage, recipient, target.endpoint);
				})
			);
		} catch {
			// sem rede ou repassador fora do ar: a mensagem chega, só sem aviso (ADR-0010)
		}
	}
}
