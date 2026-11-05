// Notificação de mensagem nova (RF-82, ADR-0010). O navegador já entrega o aviso decifrado (RFC 8291): quem
// mandou e, em grupo, qual. Nunca o conteúdo (T6). O nome vem do que este aparelho conhece, como na lista de
// conversas; sem ele, o que veio no aviso.
/// <reference lib="webworker" />
import type { PushPayload } from '@lerolero/core';
import { m } from '#lib/paraglide/messages.js';
import { baseLocale } from '#lib/paraglide/runtime.js';

declare const self: ServiceWorkerGlobalScope;

// sem janela, o service worker não sabe a língua escolhida; por enquanto só há a base (ADR-0008)
const locale = { locale: baseLocale };
const NAME_MAX = 60;

/** O aviso é dado de fora (o remetente monta): o que não confere vira "nada a mostrar". */
function parse(data: PushMessageData | null): PushPayload | undefined {
	try {
		const p = data?.json() as Partial<PushPayload> | undefined;
		if (p?.v !== 1 || typeof p.de !== 'string' || !/^[0-9a-f]{64}$/.test(p.de)) return undefined;
		const nome = typeof p.nome === 'string' ? p.nome.slice(0, NAME_MAX) : '';
		const grupo = typeof p.grupo === 'string' && /^[\w-]{1,128}$/.test(p.grupo) ? p.grupo : undefined;
		return { v: 1, de: p.de, nome, ...(grupo ? { grupo } : {}) };
	} catch {
		return undefined;
	}
}

/**
 * Lê o banco do app (o mesmo IndexedDB do Dexie) sem mudar a versão: se o banco não existe, não o cria, para o
 * Dexie criá-lo do jeito dele depois.
 */
async function readNames(de: string, grupo?: string): Promise<{ contact?: string; group?: string }> {
	const db = await new Promise<IDBDatabase | undefined>((ok) => {
		const request = indexedDB.open('lerolero');
		request.onupgradeneeded = () => request.transaction?.abort();
		request.onsuccess = () => ok(request.result);
		request.onerror = () => ok(undefined);
	});
	if (!db) return {};
	try {
		const tx = db.transaction(['contacts', 'conversations'], 'readonly');
		const get = <T,>(store: string, key: string) =>
			new Promise<T | undefined>((ok) => {
				const r = tx.objectStore(store).get(key);
				r.onsuccess = () => ok(r.result as T | undefined);
				r.onerror = () => ok(undefined);
			});
		const [contact, conversation] = await Promise.all([
			get<{ localName?: string; chosenName?: string }>('contacts', de),
			grupo ? get<{ group?: { state: { name: string } } }>('conversations', `grupo:${grupo}`) : undefined
		]);
		return { contact: contact?.localName || contact?.chosenName, group: conversation?.group?.state.name };
	} catch {
		return {};
	} finally {
		db.close();
	}
}

async function show(data: PushMessageData | null) {
	const payload = parse(data);
	const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
	// com o app na tela, a mensagem já aparece nele; o Chrome dispensa a notificação quando há uma aba visível
	if (windows.some((w) => w.visibilityState === 'visible')) return;
	const scope = self.registration.scope;
	if (!payload) {
		// a inscrição exige mostrar algo (userVisibleOnly); um aviso estragado só abre o app
		return self.registration.showNotification(m.aviso_mensagem_de({ nome: m.app_nome(undefined, locale) }, locale), { data: { url: scope } });
	}
	const names = await readNames(payload.de, payload.grupo);
	const nome = names.contact || payload.nome || m.app_nome(undefined, locale);
	const path = payload.grupo ? `grupo/${encodeURIComponent(payload.grupo)}` : `conversa/${payload.de}`;
	await self.registration.showNotification(m.aviso_mensagem_de({ nome }, locale), {
		body: payload.grupo && names.group ? m.aviso_no_grupo({ grupo: names.group }, locale) : m.aviso_toque(undefined, locale),
		icon: `${scope}icon-192.png`,
		// uma por conversa: a mais nova substitui a anterior e toca de novo
		tag: path,
		renotify: true,
		data: { url: scope + path }
	} as NotificationOptions);
}

async function open(url: string) {
	const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
	const open = windows[0];
	if (!open) return void (await self.clients.openWindow(url));
	await open.focus();
	// o app já aberto navega por dentro: recarregar a página trancaria o cofre
	open.postMessage({ tipo: 'abrir', caminho: new URL(url).pathname });
}

export function listenForPush() {
	self.addEventListener('push', (event) => event.waitUntil(show(event.data)));
	self.addEventListener('notificationclick', (event) => {
		event.notification.close();
		const url = (event.notification.data as { url?: string } | null)?.url ?? self.registration.scope;
		event.waitUntil(open(url));
	});
}
