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
	// cada teste abre 2 ou 3 Chromes: na CI, 3 e 4 workers deram o mesmo tempo que 2, com cada teste até 3 vezes mais
	// lento e menos folga nas esperas (medido em 2026-10-30, item 16)
	// fora da CI o padrão seria metade dos núcleos: com 8, cada rodada derrubava um teste diferente
	workers: ci ? 2 : 4,
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
