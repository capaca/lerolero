import { resolve } from '$app/paths';

/**
 * Endereço público do app terminado em barra (ex.: https://capaca.github.io/lerolero/), base dos convites e do link do
 * código de recuperação. No APK (ADR-0011) a interface roda em https://localhost, e o link que saía dali não abria em
 * outro aparelho (visto pelo Pedro em 2026-11-18): lá vale o endereço do Pages, gravado no build.
 */
export const appUrl = (path = '') => new URL(path, __APP_PUBLIC_URL__ || new URL(resolve('/'), location.href)).href;
