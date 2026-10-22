import { describe, expect, it } from 'vitest';
import { DELAYS_MS, FREE_ATTEMPTS, NO_FAILURES, recordFailure, waitTime } from './attempts.ts';

describe('limite de tentativas de PIN', () => {
	it('deixa errar algumas vezes sem esperar', () => {
		let state = NO_FAILURES;
		for (let i = 0; i < FREE_ATTEMPTS; i++) state = recordFailure(state, 1000);
		expect(waitTime(state, 1000)).toBe(0);
	});

	it('aumenta a espera a cada erro e para no teto', () => {
		let state = NO_FAILURES;
		for (let i = 0; i < FREE_ATTEMPTS; i++) state = recordFailure(state, 0);
		const waits = [];
		for (let i = 0; i < DELAYS_MS.length + 2; i++) {
			state = recordFailure(state, 0);
			waits.push(waitTime(state, 0));
		}
		expect(waits).toEqual([...DELAYS_MS, DELAYS_MS.at(-1), DELAYS_MS.at(-1)]);
	});

	it('libera quando o tempo passa', () => {
		let state = NO_FAILURES;
		for (let i = 0; i <= FREE_ATTEMPTS; i++) state = recordFailure(state, 0);
		expect(waitTime(state, DELAYS_MS[0] - 1)).toBe(1);
		expect(waitTime(state, DELAYS_MS[0])).toBe(0);
	});

});
