// Tamanho da letra (RNF-65): preferência do aparelho, não da conta, para valer já na tela do PIN.
// Escala o `html`; todo o resto está em rem e acompanha.
export const TEXT_SIZES = { normal: 100, grande: 120, muito_grande: 140 } as const;
export type TextSize = keyof typeof TEXT_SIZES;

const KEY = 'lerolero:tamanho-da-letra';

export function readTextSize(): TextSize {
	try {
		const value = localStorage.getItem(KEY);
		if (value && value in TEXT_SIZES) return value as TextSize;
	} catch {
		// armazenamento bloqueado: fica no normal
	}
	return 'normal';
}

export function applyTextSize(size: TextSize) {
	document.documentElement.style.fontSize = `${TEXT_SIZES[size]}%`;
}

export function saveTextSize(size: TextSize) {
	try {
		localStorage.setItem(KEY, size);
	} catch {
		// vale só até fechar o app
	}
	applyTextSize(size);
}
