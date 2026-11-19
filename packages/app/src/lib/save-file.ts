// "Salvar" no aparelho (RF-45): uma opção só. No iPhone o PWA instalado não baixa de forma confiável pelo link, e a
// folha de compartilhar tem "Salvar em Arquivos"; no resto, o link vai direto para os downloads.

import { isNativeApp, saveFileNative } from '#lib/native.ts';

const isIos = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Pode falhar com `NotAllowedError` no iPhone: compartilhar só vale logo depois de um toque, não depois de baixar. */
export async function saveFile(blob: Blob, name: string) {
	// app Android: o WebView não baixa pelo link (nada acontecia, visto na v0.18.1)
	if (isNativeApp()) return saveFileNative(blob, name);
	const file = new File([blob], name, { type: blob.type });
	if (isIos() && navigator.canShare?.({ files: [file] })) {
		try {
			await navigator.share({ files: [file] });
		} catch (err) {
			// cancelado no menu: nada foi salvo, e não é erro
			if ((err as Error).name !== 'AbortError') throw err;
		}
		return;
	}
	const url = URL.createObjectURL(file);
	const a = document.createElement('a');
	a.href = url;
	a.download = name;
	document.body.append(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
