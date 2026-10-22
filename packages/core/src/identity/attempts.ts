// Limite de tentativas de PIN: depois de alguns erros, espera crescente.
// Protege contra quem tenta adivinhar o PIN pelo próprio app, com o celular na mão.
// Não protege contra quem copia os dados do aparelho e testa fora do app; isso só o
// cofre de hardware do app nativo resolve (docs/02-modelo-de-ameacas.md).

export type AttemptState = { failures: number; lockedUntil: number };

export const NO_FAILURES: AttemptState = { failures: 0, lockedUntil: 0 };

/** Tentativas livres antes da primeira espera. */
export const FREE_ATTEMPTS = 5;

/** Espera depois de cada erro além das tentativas livres; a última se repete. */
export const DELAYS_MS = [30_000, 60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

/** Registra um erro e calcula até quando a próxima tentativa fica bloqueada. */
export function recordFailure(state: AttemptState, now: number): AttemptState {
	const failures = state.failures + 1;
	const extra = failures - FREE_ATTEMPTS;
	const delay = extra > 0 ? DELAYS_MS[Math.min(extra, DELAYS_MS.length) - 1] : 0;
	return { failures, lockedUntil: now + delay };
}

/** Milissegundos até poder tentar de novo (0 = pode agora). */
export const waitTime = (state: AttemptState, now: number): number => Math.max(0, state.lockedUntil - now);
