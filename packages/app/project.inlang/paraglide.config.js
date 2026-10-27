// Lido pelo plugin do Vite (build) e pelo `paraglide-js compile` (pnpm check). ADR-0008.
import { defineConfig } from '@inlang/paraglide-js';

export default defineConfig({
	outdir: './src/lib/paraglide',
	// SPA sem servidor: a escolha de Ajustes, depois a língua do navegador, depois pt-BR. Nada na URL,
	// para os links de convite não mudarem.
	strategy: ['localStorage', 'preferredLanguage', 'baseLocale'],
	localStorageKey: 'lerolero-lingua',
	emitTsDeclarations: true,
	emitReadme: false,
	emitPrettierIgnore: false
});
