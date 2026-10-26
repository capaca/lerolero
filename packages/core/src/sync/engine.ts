// Motor de sincronização (docs/06 §3.9, RF-80, RF-81, RNF-30..35).
//
// Receber: assina os gift wraps endereçados a mim em cada um dos meus relays de DM,
// a partir do cursor daquele relay menos 2 dias (o NIP-59 recua o horário do embrulho
// em até 2 dias). Cada embrulho é processado uma única vez, mesmo vindo de vários relays.
//
// Enviar: o que sai vai para a fila (outbox) e só sai dela quando relays confirmam.
// Sem conexão, fica guardado e é tentado de novo com espera crescente (offline primeiro).

import { verifyEvent, type NostrEvent } from 'nostr-tools/pure';
import type { Filter } from 'nostr-tools/filter';
import type { RelayPool } from '../net/pool.ts';
import type { Storage } from '../storage/repositories.ts';
import type { OutboxRecord } from '../storage/records.ts';

const DAY = 24 * 60 * 60;

/** Margem do cursor: o horário dos embrulhos é embaralhado em até 2 dias (NIP-59). */
export const CURSOR_MARGIN_S = 2 * DAY;
/** Sem cursor (primeira vez neste aparelho): busca tudo o que os relays ainda guardam. */
export const FIRST_SYNC_WINDOW_S = 9 * DAY;
/** Ids de embrulhos já vistos são guardados por 7 dias de retenção + 2 de margem. */
export const SEEN_RETENTION_S = 9 * DAY;

/** Espera antes de tentar de novo um envio; a última se repete. */
export const RETRY_DELAYS_MS = [5_000, 15_000, 60_000, 5 * 60_000, 15 * 60_000];
/**
 * Depois que um relay aceitou, ainda tentamos os outros algumas vezes: espalhar por
 * vários relays é o que protege contra um relay que perde mensagens (RNF-30).
 */
export const EXTRA_ATTEMPTS_AFTER_ACCEPTED = 3;
/** Quantos itens da fila saem ao mesmo tempo: não espera um por um o tempo esgotado de relays fora do ar. */
export const FLUSH_CONCURRENCY = 5;

/**
 * Geração da sincronização: sobe sempre que o app passa a entender um tipo novo de
 * mensagem. Uma versão antiga ignora o que não entende, mas marca o embrulho como visto;
 * sem isto, depois de atualizar, essas mensagens nunca apareceriam.
 *   1: texto (kind 14)
 *   2: áudio e arquivos (kind 15)
 *   3: apagar para todos (kind 5)
 *   4: grupos (tag `g` e avisos de grupo, kind 4440)
 */
export const SYNC_GENERATION = 4;

/**
 * Se o aparelho sincronizou com uma geração anterior, esquece cursores e embrulhos
 * vistos para reprocessar tudo o que os relays ainda guardam. Mensagens já guardadas
 * não se repetem (são identificadas pelo id). Devolve true se reprocessou.
 */
export async function upgradeSyncGeneration(storage: Storage): Promise<boolean> {
	const current = (await storage.settings.get<number>('geracaoSync')) ?? 0;
	if (current >= SYNC_GENERATION) return false;
	await storage.seenWraps.clear();
	await storage.sync.clear();
	await storage.settings.set('geracaoSync', SYNC_GENERATION);
	return true;
}

export type SyncEvents = {
	/** um embrulho novo chegou (já sem repetidos). Erros aqui não travam a sincronização. */
	onWrap: (wrap: NostrEvent, relay: string) => Promise<void>;
	/** um item da fila foi aceito pelo primeiro relay (a mensagem passa a "enviada") */
	onSent?: (item: OutboxRecord) => Promise<void>;
};

export type SyncOptions = {
	storage: Storage;
	pool: RelayPool;
	myPublicKey: string;
	events: SyncEvents;
	now?: () => number;
	/** false enquanto o aparelho está sem internet: a fila espera, sem gastar tentativas nem aumentar a espera */
	canSend?: () => boolean;
};

export class SyncEngine {
	private readonly storage: Storage;
	private readonly pool: RelayPool;
	private readonly myPublicKey: string;
	private readonly events: SyncEvents;
	private readonly now: () => number;
	private readonly canSend: () => boolean;
	private lastQueuedAt = 0;
	private subscription?: { close: () => void };
	private cursors = new Map<string, number>();
	private flushing?: Promise<void>;
	private retryTimer?: ReturnType<typeof setTimeout>;
	/** processa um embrulho por vez: o mesmo pode chegar de dois relays ao mesmo tempo */
	private queue: Promise<void> = Promise.resolve();

	constructor(options: SyncOptions) {
		this.storage = options.storage;
		this.pool = options.pool;
		this.myPublicKey = options.myPublicKey;
		this.events = options.events;
		this.now = options.now ?? Date.now;
		this.canSend = options.canSend ?? (() => true);
	}

	/** Começa a receber nos relays indicados (os meus relays de DM). */
	async start(relays: string[]) {
		this.stop();
		for (const relay of relays) {
			const cursor = await this.storage.sync.getCursor(relay);
			if (cursor !== undefined) this.cursors.set(relay, cursor);
		}
		this.subscription = this.pool.subscribe(
			relays,
			(relay) => [this.filterFor(relay)],
			(relay) => ({ onevent: (event) => this.receive(relay, event) })
		);
		void this.storage.seenWraps.prune(this.seconds() - SEEN_RETENTION_S);
		void this.flush();
	}

	stop() {
		this.subscription?.close();
		this.subscription = undefined;
		clearTimeout(this.retryTimer);
	}

	/** O app voltou para a tela ou a internet voltou (RF-80): reconecta e esvazia a fila. */
	resume() {
		this.pool.reconnectNow();
		void this.retryAllNow().then(() => this.flush());
	}

	/**
	 * A espera de uma tentativa anterior não vale mais depois que a conexão volta: tenta tudo já, na ordem. Sem
	 * isto, a mensagem que falhou primeiro (e por isso tem a espera mais longa) saía por último, minutos depois.
	 */
	private async retryAllNow() {
		const now = this.now();
		for (const item of await this.storage.outbox.due(Infinity)) {
			if (item.nextAttemptAt > now) await this.storage.outbox.put({ ...item, nextAttemptAt: now });
		}
	}

	/** Coloca na fila e tenta enviar já. */
	async enqueue(event: NostrEvent, relays: string[], messageId?: string) {
		const queuedAt = Math.max(this.now(), this.lastQueuedAt + 1);
		this.lastQueuedAt = queuedAt;
		await this.storage.outbox.put({
			id: event.id,
			event,
			relays: [...new Set(relays)],
			acceptedBy: [],
			messageId,
			attempts: 0,
			nextAttemptAt: this.now(),
			queuedAt
		});
		await this.flush();
	}

	/** Tenta enviar o que está na fila e já pode ser tentado. Chamadas simultâneas esperam a mesma rodada. */
	flush(): Promise<void> {
		this.flushing ??= this.flushOnce().finally(() => (this.flushing = undefined));
		return this.flushing;
	}

	private filterFor(relay: string): Filter {
		const cursor = this.cursors.get(relay);
		const since = cursor !== undefined ? cursor - CURSOR_MARGIN_S : this.seconds() - FIRST_SYNC_WINDOW_S;
		return { kinds: [1059], '#p': [this.myPublicKey], since };
	}

	private receive(relay: string, wrap: NostrEvent) {
		this.queue = this.queue.then(() => this.process(relay, wrap)).catch(() => undefined);
	}

	private async process(relay: string, wrap: NostrEvent) {
		if (wrap.kind !== 1059 || !wrap.tags.some((t) => t[0] === 'p' && t[1] === this.myPublicKey)) return;
		if (!(await this.storage.seenWraps.has(wrap.id))) {
			try {
				await this.events.onWrap(wrap, relay);
			} catch {
				// embrulho que não abre ou não é para nós: descartado, o resto segue
			}
			// marca depois de processar (RNF-30): se o app morrer no meio, a mensagem ainda não foi guardada e
			// precisa vir de novo. O inválido também é marcado, para não ser tentado a cada sincronização.
			await this.storage.seenWraps.add({ id: wrap.id, receivedAt: this.seconds() });
		}
		const cursor = this.cursors.get(relay);
		if (cursor === undefined || wrap.created_at > cursor) {
			this.cursors.set(relay, wrap.created_at);
			await this.storage.sync.setCursor(relay, wrap.created_at);
		}
	}

	private async flushOnce() {
		clearTimeout(this.retryTimer);
		if (this.canSend()) {
			// repete até esvaziar: o que entrou na fila durante a rodada também sai, sem esperar a próxima espera
			for (;;) {
				const due = (await this.storage.outbox.due(this.now())).sort((a, b) => (a.queuedAt ?? a.nextAttemptAt) - (b.queuedAt ?? b.nextAttemptAt));
				if (due.length === 0) break;
				// em lotes, na ordem em que foram escritas
				for (let i = 0; i < due.length; i += FLUSH_CONCURRENCY) {
					await Promise.all(due.slice(i, i + FLUSH_CONCURRENCY).map((item) => this.sendItem(item)));
				}
			}
		}
		await this.scheduleNextRetry();
	}

	private async sendItem(item: OutboxRecord) {
		const pending = item.relays.filter((r) => !item.acceptedBy.includes(r));
		// "enviada" assim que o primeiro relay aceita, sem esperar o mais lento (a tela mostra antes)
		let firstAccept: Promise<void> | undefined;
		const results = await this.pool.publish(pending, item.event, (_, result) => {
			if (result.ok && item.acceptedBy.length === 0 && !firstAccept) {
				firstAccept = this.events.onSent?.({ ...item, acceptedBy: [] }) ?? Promise.resolve();
			}
		});
		await firstAccept;
		const newlyAccepted = pending.filter((r) => results[r]?.ok);
		const acceptedBy = [...item.acceptedBy, ...newlyAccepted];
		const attempts = item.attempts + 1;
		const updated: OutboxRecord = { ...item, acceptedBy, attempts, nextAttemptAt: this.now() + this.retryDelay(attempts) };

		const allAccepted = acceptedBy.length === item.relays.length;
		const enoughExtra = item.acceptedBy.length > 0 && attempts >= EXTRA_ATTEMPTS_AFTER_ACCEPTED;
		if (allAccepted || enoughExtra) await this.storage.outbox.delete(item.id);
		else await this.storage.outbox.put(updated);
	}

	private async scheduleNextRetry() {
		if (!this.canSend()) return; // sem internet: quem avisa é o evento de "voltou" (resume)
		const next = (await this.storage.outbox.due(Infinity))[0];
		if (!next) return;
		const wait = Math.max(0, next.nextAttemptAt - this.now());
		this.retryTimer = setTimeout(() => void this.flush(), wait);
	}

	private retryDelay(attempts: number) {
		return RETRY_DELAYS_MS[Math.min(attempts, RETRY_DELAYS_MS.length) - 1];
	}

	private seconds() {
		return Math.floor(this.now() / 1000);
	}
}

/** Evento kind 10050 (NIP-17): onde recebo mensagens. Assinado pelo cofre. */
export function dmRelayListTemplate(relays: string[], now = Date.now()) {
	return {
		kind: 10050,
		created_at: Math.floor(now / 1000),
		tags: relays.map((r) => ['relay', r]),
		content: ''
	};
}

/**
 * Descobre onde um contato recebe mensagens: o kind 10050 mais recente dele nos
 * relays gerais. Usado quando o convite não trouxe relays (ex.: npub de outro app).
 */
export async function fetchDmRelays(pool: RelayPool, generalRelays: string[], publicKey: string): Promise<string[]> {
	// sem `limit: 1`: um relay poderia servir só um evento falso mais novo e esconder o verdadeiro
	const events = await pool.query(generalRelays, [{ kinds: [10050], authors: [publicKey] }]);
	// o relay poderia inventar um 10050 para desviar as mensagens: só vale o assinado pelo contato
	const latest = events
		.filter((e) => e.pubkey === publicKey && e.kind === 10050 && verifyEvent(e))
		.sort((a, b) => b.created_at - a.created_at)[0];
	if (!latest) return [];
	return latest.tags.filter((t) => t[0] === 'relay' && /^wss:\/\//.test(t[1] ?? '')).map((t) => t[1]).slice(0, 3);
}
