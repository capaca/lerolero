// Quando pedir para guardar a frase (RF-03, RF-04, Q-U1): não no cadastro, mas quando
// passa a haver algo a perder, ao ganhar o primeiro contato.
import { highRiskOfDataLoss } from './platform.ts';
import { session } from './session.svelte.ts';

const SNOOZE_KEY = 'lembreteFraseAdiadoAte';
const OFFERED_KEY = 'fraseOferecida';
const DAY = 24 * 60 * 60 * 1000;

/** A tela "Guarde sua frase" aparece uma vez só, ao adicionar um contato com a frase ainda não conferida. */
export async function phraseOfferDue(): Promise<boolean> {
	return !session.identity?.phraseConfirmed && !(await session.getSetting<boolean>(OFFERED_KEY));
}

export const markPhraseOffered = () => session.setSetting(OFFERED_KEY, true);

/** O aviso na tela inicial: só com algum contato, e não enquanto estiver adiado. */
export async function phraseReminderDue(contactCount: number): Promise<boolean> {
	if (session.identity?.phraseConfirmed || contactCount === 0) return false;
	return Date.now() > ((await session.getSetting<number>(SNOOZE_KEY)) ?? 0);
}

/** "Depois": volta em 3 dias, ou em 1 se o risco de perder os dados for maior. */
export const snoozePhraseReminder = () =>
	session.setSetting(SNOOZE_KEY, Date.now() + (highRiskOfDataLoss() ? 1 : 3) * DAY);
