// Onde a voz começa numa gravação: o trecho vazio antes dela (entre o toque em gravar e a pessoa falar) é pulado
// ao tocar, sem recodificar o arquivo. Lê o nível do microfone enquanto grava, em janelas de ~20 ms.
// Na dúvida não corta: ruído alto de fundo ou voz baixa fazem o detector não achar a voz, e o áudio toca inteiro.

/** janelas seguidas acima do limiar para valer como voz (~100 ms): estalo e tosse curta não contam */
const RUN = 5;
/** quanto antes da voz o áudio começa, para não comer a primeira sílaba */
const PAD_S = 0.3;
/** pular menos que isto não compensa */
const MIN_SKIP_S = 0.6;
/** nível mínimo (RMS de 0 a 1) para ser voz, e quantas vezes acima do ruído de fundo */
const MIN_LEVEL = 0.015;
const NOISE_RATIO = 3;
const MIN_FLOOR = 0.002;

export class VoiceStartDetector {
	private floor = Infinity;
	private run = 0;
	private runStart = 0;
	private found?: number;

	/** `level`: RMS da janela (0 a 1); `seconds`: tempo de gravação no início da janela */
	push(level: number, seconds: number) {
		if (this.found !== undefined) return;
		this.floor = Math.min(this.floor, Math.max(level, MIN_FLOOR));
		if (level > Math.max(MIN_LEVEL, this.floor * NOISE_RATIO)) {
			if (this.run === 0) this.runStart = seconds;
			if (++this.run >= RUN) this.found = this.runStart;
		} else {
			this.run = 0;
		}
	}

	/** Segundos a pular no começo; 0 se a voz começou logo ou não foi achada. */
	get skip(): number {
		const s = (this.found ?? 0) - PAD_S;
		return s >= MIN_SKIP_S ? Math.round(s * 10) / 10 : 0;
	}
}

/** Nível RMS de uma janela de amostras (-1 a 1). */
export function rms(samples: ArrayLike<number>): number {
	let sum = 0;
	for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
	return Math.sqrt(sum / Math.max(1, samples.length));
}
