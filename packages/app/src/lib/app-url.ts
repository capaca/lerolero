import { resolve } from '$app/paths';

/** Endereço do app terminado em barra (ex.: https://capaca.github.io/lerolero/), base dos convites. */
export const appUrl = () => new URL(resolve('/'), location.href).href;
