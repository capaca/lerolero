<script lang="ts" module>
	// O TypeScript não declara o PasswordCredential, que só o Chrome tem
	type PasswordCredentialInit = { id: string; password: string; name?: string };
	type PasswordCredentialClass = new (init: PasswordCredentialInit) => Credential;
	type PasswordCredentialResult = Credential & { password?: string };

	const passwordCredential = () => (window as unknown as { PasswordCredential?: PasswordCredentialClass }).PasswordCredential;

	/** O código salvo no gerenciador de senhas do navegador, para a restauração; `undefined` sem nada salvo ou sem suporte. */
	export async function savedPhrase(): Promise<string | undefined> {
		if (!passwordCredential() || !navigator.credentials?.get) return undefined;
		const credential = (await navigator.credentials.get({ password: true, mediation: 'optional' } as CredentialRequestOptions)) as PasswordCredentialResult | null;
		return credential?.password || undefined;
	}

	export const canReadSavedPhrase = () => !!passwordCredential() && !!navigator.credentials?.get;
</script>

<script lang="ts">
	// Guardar o código de recuperação no gerenciador de senhas do navegador (RF-09 b, ADR-0009 D1, regra 7): o Chrome
	// salva pelo PasswordCredential, sem depender de adivinhar o envio de um formulário; onde ele não existe, um
	// formulário de nome e código que é enviado e some. Medido no Motorola, no PWA instalado (2026-10-29). O app não sabe
	// se a pessoa aceitou o "Salvar senha?"; por isso, como no arquivo, a conta só fica protegida quando ela confirma.
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { session } from '#lib/session.svelte.ts';

	let { words, onsaved }: { words: string[]; onsaved: () => void } = $props();

	// o nome é o que aparece no gerenciador; o endereço do site ele mostra sozinho
	const account = $derived(m.senha_conta({ nome: session.identity?.displayName ?? '' }));
	const phrase = $derived(words.join(' '));
	const native = !!passwordCredential();
	let asked = $state(false);
	let busy = $state(false);
	let error = $state('');

	async function store() {
		busy = true;
		error = '';
		try {
			const PasswordCredential = passwordCredential()!;
			await navigator.credentials.store(new PasswordCredential({ id: account, password: phrase, name: account }));
			asked = true;
		} catch (err) {
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
	<p>{m.senha_dica()}</p>
	{#if !asked}
		{#if native}
			<div class="actions stack">
				<button class="primary" disabled={busy} onclick={store}>{m.senha_guardar()}</button>
			</div>
		{:else}
			<form onsubmit={submit}>
				<label for="senha-conta">{m.senha_rotulo_conta()}</label>
				<input id="senha-conta" name="username" autocomplete="username" value={account} />
				<label for="senha-codigo">{m.senha_rotulo_codigo()}</label>
				<input id="senha-codigo" name="password" type="password" autocomplete="new-password" value={phrase} />
				<div class="actions stack">
					<button class="primary" type="submit" disabled={busy}>{m.senha_guardar()}</button>
				</div>
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
		border-bottom: 1px solid var(--line);
		padding-bottom: 1rem;
		margin-bottom: 1rem;
	}
</style>
