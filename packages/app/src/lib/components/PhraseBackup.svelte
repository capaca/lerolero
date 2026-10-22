<script lang="ts">
	// Mostra a frase e orienta onde guardar: papel ou gerenciador de senhas.
	// Usado no cadastro e em "ver minha frase".
	import { onDestroy } from 'svelte';
	import PhraseGrid from './PhraseGrid.svelte';

	let { words }: { words: string[] } = $props();

	const CLEAR_AFTER_MS = 60_000;
	let copied = $state(false);
	let clearTimer: ReturnType<typeof setTimeout> | undefined;

	async function copy() {
		await navigator.clipboard.writeText(words.join(' '));
		copied = true;
		clearTimeout(clearTimer);
		// o navegador só deixa mexer na área de transferência com o app aberto e em foco;
		// se a pessoa saiu, não dá para limpar, e por isso o aviso é o que mais importa
		clearTimer = setTimeout(async () => {
			try {
				await navigator.clipboard.writeText('');
			} catch {
				// sem foco: fica como está
			}
			copied = false;
		}, CLEAR_AFTER_MS);
	}

	onDestroy(() => clearTimeout(clearTimer));
</script>

<div class="banner">
	<p>
		<strong>Guarde estas 12 palavras, na ordem.</strong> Se você perder o celular ou esquecer o PIN, só esta
		frase recupera sua conta. Ninguém mais consegue recuperar para você, nem a equipe do Lero-lero.
	</p>
	<p>Escolha um jeito de guardar:</p>
	<ul>
		<li>
			<strong>Num papel</strong>, guardado num lugar seguro de casa (não na carteira nem no celular). Papel
			não pode ser invadido pela internet.
		</li>
		<li>
			<strong>Num gerenciador de senhas</strong> (o do Google, o da Apple, Bitwarden…), se você já usa um.
		</li>
	</ul>
	<p>Nunca tire print e nunca mande a frase para ninguém: quem tem a frase vira você.</p>
</div>

<PhraseGrid {words} />

<div class="copy">
	<button type="button" onclick={copy}>{copied ? 'Copiada' : 'Copiar a frase'}</button>
	<p class="hint">
		Cole só no gerenciador de senhas. O teclado do celular e a nuvem podem guardar o que você copia; por isso
		limpamos a cópia depois de 1 minuto, se o app ainda estiver aberto.
	</p>
</div>

<style>
	ul {
		margin: 0 0 0.5rem;
		padding-left: 1.2rem;
	}
	li {
		margin-bottom: 0.3rem;
	}
	.copy .hint {
		margin-top: 0.4rem;
	}
</style>
