// Leitura de QR pela câmera (RF-10). Usa a API nativa do navegador quando existe
// (Chrome no Android); senão carrega o jsQR, só nesta tela, para não pesar no app.

type Detect = (source: HTMLVideoElement, canvas: HTMLCanvasElement) => Promise<string | undefined>;

async function makeDetector(): Promise<Detect> {
	const Native = (globalThis as { BarcodeDetector?: any }).BarcodeDetector;
	if (Native && (await Native.getSupportedFormats?.())?.includes('qr_code')) {
		const detector = new Native({ formats: ['qr_code'] });
		return async (video) => (await detector.detect(video))[0]?.rawValue;
	}
	const { default: jsQR } = await import('jsqr');
	return async (video, canvas) => {
		const width = video.videoWidth;
		const height = video.videoHeight;
		if (!width || !height) return undefined;
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
		ctx.drawImage(video, 0, 0, width, height);
		return jsQR(ctx.getImageData(0, 0, width, height).data, width, height)?.data;
	};
}

/** Liga a câmera traseira no `video` e chama `onResult` com o primeiro QR lido. Devolve a função para parar. */
export async function startScanner(video: HTMLVideoElement, onResult: (text: string) => void): Promise<() => void> {
	const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
	video.srcObject = stream;
	await video.play();
	const detect = await makeDetector();
	const canvas = document.createElement('canvas');
	let stopped = false;
	const stop = () => {
		stopped = true;
		stream.getTracks().forEach((t) => t.stop());
		video.srcObject = null;
	};
	(async function loop() {
		while (!stopped) {
			const text = await detect(video, canvas).catch(() => undefined);
			if (text && !stopped) {
				stop();
				onResult(text);
				return;
			}
			await new Promise((r) => setTimeout(r, 250));
		}
	})();
	return stop;
}
