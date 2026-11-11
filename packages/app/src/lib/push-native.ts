// As notificações do app nativo (ADR-0011): o plugin Avisos do APK (packages/android, AvisosPlugin.java) pede a
// permissão, gera o par de cifra (a privada fica no aparelho) e devolve o token do FCM. No PWA nada disto existe.

import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { NativePushTarget } from '@lerolero/core';
import { m } from '#lib/paraglide/messages.js';

type Permission = 'granted' | 'denied' | 'prompt';

/** Os textos da notificação vão prontos: o serviço do FCM roda com o app fechado, sem o Paraglide (ADR-0008). */
type Texts = { titulo: string; toque: string; canal: string; anonimo: string };

interface AvisosPlugin {
	ativar(options: { renovar: boolean; textos: Texts }): Promise<NativePushTarget>;
	desativar(): Promise<void>;
	estado(): Promise<{ permissao: Permission; fcm?: string }>;
	caminhoPendente(): Promise<{ caminho?: string }>;
	addListener(event: 'abrir', listener: (data: { caminho: string }) => void): Promise<PluginListenerHandle>;
}

const Avisos = registerPlugin<AvisosPlugin>('Avisos');

export function isNativeApp(): boolean {
	return Capacitor.isNativePlatform();
}

export function enableNativePush(renew: boolean): Promise<NativePushTarget> {
	const textos = { titulo: m.aviso_mensagem_de({ nome: '{nome}' }), toque: m.aviso_toque(), canal: m.aviso_canal(), anonimo: m.app_nome() };
	return Avisos.ativar({ renovar: renew, textos });
}

export function disableNativePush(): Promise<void> {
	return Avisos.desativar();
}

export function nativePushState() {
	return Avisos.estado();
}

/**
 * Toque numa notificação: com o app fechado, o caminho espera a interface abrir; com ele aberto, chega na hora.
 * `open` recebe o caminho relativo à raiz do app (`conversa/<chave>` ou `grupo/<id>`).
 */
export function onNativePushOpen(open: (path: string) => void): () => void {
	if (!isNativeApp()) return () => {};
	void Avisos.caminhoPendente().then((r) => r.caminho && open(r.caminho)).catch(() => {});
	const handle = Avisos.addListener('abrir', (data) => open(data.caminho));
	return () => void handle.then((h) => h.remove());
}
