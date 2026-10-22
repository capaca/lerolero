// Detecção do que muda o risco de perder a identidade.

/** iPhone/iPad, inclusive iPad que se apresenta como Mac. */
export function isIOS(): boolean {
	return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Aberto como app instalado (tela de início), e não numa aba do navegador. */
export function isInstalled(): boolean {
	return matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

/**
 * No iPhone, o Safari pode apagar os dados de sites não instalados depois de alguns
 * dias sem uso. Sem a frase guardada, isso é perder a identidade sem perder o celular.
 */
export const highRiskOfDataLoss = () => isIOS() && !isInstalled();
