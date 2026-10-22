<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head><title>Lero-lero</title></svelte:head>

<main>
	<h1>Lero-lero</h1>
	<p>Mensagens privadas, sem dono e sem telefone.</p>
	<p class="hint">
		Você não precisa de número nem de e-mail. Sua conta fica só neste aparelho, protegida por um PIN, e
		pode ser recuperada com uma frase de 12 palavras.
	</p>
	<div class="actions stack">
		<a class="button primary" href={resolve('/cadastro')}>Criar minha conta</a>
		<a class="button" href={resolve('/restaurar')}>Já tenho uma conta (tenho a frase)</a>
	</div>
	<p class="hint">Está participando do teste? Veja <a href={resolve('/teste')}>como testar</a>.</p>
</main>

<style>
	.button {
		display: block;
		text-align: center;
		text-decoration: none;
		font-weight: 600;
		padding: 0.8rem 1.1rem;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--fg);
	}
	.button.primary {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-fg);
	}
</style>
