// Suíte de ponta a ponta (ADR-0006): o app de produção (build com BASE_PATH=/lerolero) num Chrome de verdade,
// com relays e Blossom locais (servidores.ts). A rede real fica com os testes de integração.
import { defineConfig } from '@playwright/test';
import { APP_URL } from './servidores.ts';

const ci = !!process.env.CI;

export default defineConfig({
	testDir: 'testes',
	globalSetup: './servidores.ts',
	timeout: 60_000,
	expect: { timeout: 15_000 },
	// relay local é estável: falha de verdade não deve passar escondida numa segunda tentativa
	retries: 0,
	// a máquina da CI (ubuntu-latest) tem 4 núcleos: um worker por núcleo (item 16, velocidade da suíte)
	workers: ci ? 2 : undefined,
	reporter: ci ? [['list'], ['github']] : 'list',
	outputDir: 'resultados',
	use: {
		baseURL: APP_URL,
		// o Chrome instalado (Mac do Pedro e ubuntu-latest da CI): sem baixar navegador
		channel: 'chrome',
		// microfone simulado (um tom) para gravar áudio; tocar sem gesto do usuário
		launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] },
		viewport: { width: 400, height: 850 },
		locale: 'pt-BR',
		// os Blossom locais usam certificado autoassinado (servidores.ts)
		ignoreHTTPSErrors: true,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	}
});
