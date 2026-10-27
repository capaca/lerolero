<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { resolve } from '$app/paths';
</script>

<svelte:head><title>{m.app_nome()}</title></svelte:head>

<main>
	<h1>{m.app_nome()}</h1>
	<p>{m.bemvindo_lema()}</p>
	<p class="hint">{m.bemvindo_explicacao()}</p>
	<div class="actions stack">
		<a class="button primary" href={resolve('/cadastro')}>{m.bemvindo_criar()}</a>
		<a class="button" href={resolve('/restaurar')}>{m.bemvindo_tenho_conta()}</a>
	</div>
	<p class="hint">{m.bemvindo_teste_antes()} <a href={resolve('/teste')}>{m.bemvindo_teste_link()}</a>.</p>
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
