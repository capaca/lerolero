<script lang="ts" module>
	import { isNativeApp, readPasswordNative, storePasswordNative } from '#lib/native.ts';

	// O TypeScript não declara o PasswordCredential, que só o Chrome tem
	type PasswordCredentialInit = { id: string; password: string; name?: string };
	type PasswordCredentialClass = new (init: PasswordCredentialInit) => Credential;
	type PasswordCredentialResult = Credential & { password?: string };

	// o WebView do app Android tem o PasswordCredential, mas recusa guardar (NotSupportedError, v0.18.1): lá o código vai
	// pelo Credential Manager do Android, no Gerenciador de senhas do Google
	const passwordCredential = () =>
		isNativeApp() ? undefined : (window as unknown as { PasswordCredential?: PasswordCredentialClass }).PasswordCredential;

	/** O código salvo no gerenciador de senhas do navegador, para a restauração; `undefined` sem nada salvo ou sem suporte. */
	export async function savedPhrase(): Promise<string | undefined> {
		if (isNativeApp()) return readPasswordNative();
		if (!passwordCredential() || !navigator.credentials?.get) return undefined;
		const credential = (await navigator.credentials.get({ password: true, mediation: 'optional' } as CredentialRequestOptions)) as PasswordCredentialResult | null;
		return credential?.password || undefined;
	}

	export const canReadSavedPhrase = () => isNativeApp() || (!!passwordCredential() && !!navigator.credentials?.get);
</script>

<script lang="ts">
	// Guardar o código de recuperação no gerenciador de senhas do navegador (RF-09 b, ADR-0009 D1, regra 7): o Chrome
	// salva pelo PasswordCredential, sem depender de adivinhar o envio de um formulário; onde ele não existe, um
	// formulário de nome e código que é enviado e some. Medido no Motorola, no PWA instalado (2026-10-29). O app não sabe
	// se a pessoa aceitou o "Salvar senha?"; por isso, como no arquivo, a conta só fica protegida quando ela confirma.
	import { resolve } from '$app/paths';
	import Icon from './Icon.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { session } from '#lib/session.svelte.ts';

	let { words, onsaved }: { words: string[]; onsaved: () => void } = $props();

	// o nome é o que aparece no gerenciador; o endereço do site ele mostra sozinho
	const account = $derived(m.senha_conta({ nome: session.identity?.displayName ?? '' }));
	const phrase = $derived(words.join(' '));
	const android = isNativeApp();
	const native = android || !!passwordCredential();
	let asked = $state(false);
	let busy = $state(false);
	let error = $state('');

	async function store() {
		busy = true;
		error = '';
		try {
			if (android) await storePasswordNative(account, phrase);
			else {
				const PasswordCredential = passwordCredential()!;
				await navigator.credentials.store(new PasswordCredential({ id: account, password: phrase, name: account }));
			}
			asked = true;
		} catch (err) {
			// fechou a folha do Android sem guardar: não é erro, a opção continua ali
			if ((err as Error).name === 'AbortError') return;
			error = (err as Error).name || String(err);
		} finally {
			busy = false;
		}
	}

	// sem PasswordCredential, o navegador reconhece o envio quando um fetch termina e o formulário sai da página
	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = '';
		try {
			await fetch(resolve('/') + 'robots.txt', { cache: 'no-store' });
			asked = true;
		} catch (err) {
			error = (err as Error).name || String(err);
		} finally {
			busy = false;
		}
	}
</script>

<section class="password">
	{#if !asked}
		{#if native}
			<button class="option best" disabled={busy} onclick={store}>
				<span class="option-icon"><Icon name="key" /></span>
				<span class="option-text"><span class="option-tag">{m.senha_mais_facil()}</span><b>{m.senha_guardar()}</b><small>{m.senha_dica_curta()}</small></span>
				<Icon name="chevron-right" size={18} />
			</button>
		{:else}
			<form onsubmit={submit}>
				<label for="senha-conta">{m.senha_rotulo_conta()}</label>
				<input id="senha-conta" name="username" autocomplete="username" value={account} />
				<label for="senha-codigo">{m.senha_rotulo_codigo()}</label>
				<input id="senha-codigo" name="password" type="password" autocomplete="new-password" value={phrase} />
				<button class="option best" type="submit" disabled={busy}>
					<span class="option-icon"><Icon name="key" /></span>
					<span class="option-text"><span class="option-tag">{m.senha_mais_facil()}</span><b>{m.senha_guardar()}</b><small>{m.senha_dica_curta()}</small></span>
					<Icon name="chevron-right" size={18} />
				</button>
			</form>
		{/if}
		{#if error}<p class="error" role="alert">{m.senha_erro({ erro: error })}</p>{/if}
	{:else}
		<div role="status">
			<p>{m.senha_confirme()}</p>
			<div class="actions stack">
				<button class="primary" onclick={onsaved}>{m.senha_salvei()}</button>
				<button onclick={() => (asked = false)}>{m.senha_tentar_de_novo()}</button>
			</div>
		</div>
	{/if}
</section>

<style>
	.password {
		margin: 1rem 0 0.6rem;
	}
</style>
