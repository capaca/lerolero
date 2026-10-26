// Gravação de áudio em Opus (RF-40, Q-R2): nativa onde o navegador grava Opus
// (Chrome, Firefox, Edge, Safari 18.4+). Sem Opus, o app avisa em vez de gravar outro formato.

import { rms, VoiceStartDetector } from '@lerolero/core';

const OPUS_TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4;codecs=opus'];

/**
 * Voz em Opus: ~28 kbps dá ~210 KB por minuto. Com 20 kbps, em lugar barulhento
 * (academia, rua) o ruído comia boa parte dos bits e a voz ficava ruim (RNF-22).
 */
const BITRATE = 28_000;

export const MAX_SECONDS = 5 * 60;

export function opusRecordingType(): string | undefined {
	if (typeof MediaRecorder === 'undefined') return undefined;
	return OPUS_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
}

export type Recording = {
	startedAt: number;
	/** termina e devolve o arquivo, a duração e os segundos de silêncio do começo (0 se não há o que pular) */
	stop(): Promise<{ file: Blob; duration: number; start: number }>;
	cancel(): void;
};

export async function startRecording(): Promise<Recording> {
	const mimeType = opusRecordingType();
	if (!mimeType) throw Object.assign(new Error('Sem Opus'), { name: 'NoOpusError' });
	// Sem controle automático de volume: no Motorola do Pedro, em lugar barulhento, ele cortava a
	// voz no começo do áudio (2026-10-22); antes dele, sem cortes.
	const stream = await navigator.mediaDevices.getUserMedia({
		audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false, channelCount: 1 }
	});
	const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: BITRATE });
	const chunks: Blob[] = [];
	recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
	const startedAt = performance.now();
	const watcher = watchVoiceStart(stream, startedAt);
	const release = () => {
		watcher.close();
		stream.getTracks().forEach((t) => t.stop());
	};
	recorder.start(1000);
	return {
		startedAt,
		stop: () =>
			new Promise((resolve) => {
				recorder.onstop = () => {
					release();
					resolve({
						file: new Blob(chunks, { type: recorder.mimeType || mimeType }),
						duration: (performance.now() - startedAt) / 1000,
						start: watcher.skip()
					});
				};
				recorder.stop();
			}),
		cancel: () => {
			recorder.onstop = release;
			if (recorder.state !== 'inactive') recorder.stop();
			else release();
		}
	};
}

/**
 * Lê o nível do microfone enquanto grava para achar onde a voz começa (core: media/voice-start.ts). Qualquer
 * falha aqui (sem AudioContext, por exemplo) só significa "não pular nada": a gravação não depende disto.
 */
function watchVoiceStart(stream: MediaStream, startedAt: number) {
	const detector = new VoiceStartDetector();
	let context: AudioContext | undefined;
	let timer: ReturnType<typeof setInterval> | undefined;
	try {
		context = new AudioContext();
		const analyser = context.createAnalyser();
		analyser.fftSize = 1024;
		context.createMediaStreamSource(stream).connect(analyser);
		const samples = new Float32Array(analyser.fftSize);
		timer = setInterval(() => {
			analyser.getFloatTimeDomainData(samples);
			detector.push(rms(samples), (performance.now() - startedAt) / 1000);
		}, 20);
	} catch {
		// sem análise: o áudio toca inteiro
	}
	return {
		skip: () => detector.skip,
		close: () => {
			clearInterval(timer);
			void context?.close().catch(() => {});
		}
	};
}
