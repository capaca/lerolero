import { describe, expect, it } from 'vitest';
import { rms, VoiceStartDetector } from './voice-start.ts';

/** alimenta o detector com janelas de 20 ms: silêncio até `voiceAt` segundos, depois voz */
function record(opts: { voiceAt?: number; seconds?: number; silence?: number; voice?: number; blipAt?: number }) {
	const detector = new VoiceStartDetector();
	const { voiceAt = Infinity, seconds = 4, silence = 0.004, voice = 0.12 } = opts;
	for (let t = 0; t < seconds; t += 0.02) {
		let level = t >= voiceAt ? voice : silence;
		if (opts.blipAt !== undefined && t >= opts.blipAt && t < opts.blipAt + 0.04) level = 0.3; // estalo curto
		detector.push(level, t);
	}
	return detector.skip;
}

describe('onde a voz começa', () => {
	it('pula o silêncio do começo, deixando uma folga antes da voz', () => {
		expect(record({ voiceAt: 1.5 })).toBeCloseTo(1.2, 1);
	});

	it('não corta quando a pessoa fala logo', () => {
		expect(record({ voiceAt: 0.2 })).toBe(0);
		expect(record({ voiceAt: 0.8 })).toBe(0); // 0,5 s depois da folga: abaixo do mínimo para valer
	});

	it('ignora um estalo curto antes da voz', () => {
		expect(record({ voiceAt: 2, blipAt: 0.6 })).toBeCloseTo(1.7, 1);
	});

	it('sem voz, não corta nada', () => {
		expect(record({})).toBe(0);
	});

	it('com ruído de fundo alto e voz só um pouco acima, não corta (na dúvida toca inteiro)', () => {
		expect(record({ voiceAt: 2, silence: 0.08, voice: 0.18 })).toBe(0);
	});

	it('com ruído de fundo moderado e voz clara, corta', () => {
		expect(record({ voiceAt: 2, silence: 0.02, voice: 0.2 })).toBeCloseTo(1.7, 1);
	});

	it('rms de uma janela', () => {
		expect(rms([0, 0, 0, 0])).toBe(0);
		expect(rms([0.5, -0.5, 0.5, -0.5])).toBeCloseTo(0.5, 5);
	});
});
