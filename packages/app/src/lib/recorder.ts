// Gravação de áudio em Opus (RF-40, Q-R2): nativa onde o navegador grava Opus
// (Chrome, Firefox, Edge, Safari 18.4+). Sem Opus, o app avisa em vez de gravar outro formato.

const OPUS_TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4;codecs=opus'];

/** Voz em Opus: ~20 kbps dá ~150 KB por minuto, perto do WhatsApp (RNF-22). */
const BITRATE = 20_000;

export const MAX_SECONDS = 5 * 60;

export function opusRecordingType(): string | undefined {
	if (typeof MediaRecorder === 'undefined') return undefined;
	return OPUS_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
}

export type Recording = {
	startedAt: number;
	/** termina e devolve o arquivo e a duração em segundos */
	stop(): Promise<{ file: Blob; duration: number }>;
	cancel(): void;
};

export async function startRecording(): Promise<Recording> {
	const mimeType = opusRecordingType();
	if (!mimeType) throw Object.assign(new Error('Sem Opus'), { name: 'NoOpusError' });
	const stream = await navigator.mediaDevices.getUserMedia({
		audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 }
	});
	const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: BITRATE });
	const chunks: Blob[] = [];
	recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
	const release = () => stream.getTracks().forEach((t) => t.stop());
	const startedAt = performance.now();
	recorder.start(1000);
	return {
		startedAt,
		stop: () =>
			new Promise((resolve) => {
				recorder.onstop = () => {
					release();
					resolve({
						file: new Blob(chunks, { type: recorder.mimeType || mimeType }),
						duration: (performance.now() - startedAt) / 1000
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
