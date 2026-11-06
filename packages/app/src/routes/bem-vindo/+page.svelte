<script lang="ts">
	// Primeira tela (item 26): a marca no centro, três promessas curtas e os botões perto do polegar.
	import { asset, resolve } from '$app/paths';
	import Icon from '#lib/components/Icon.svelte';
	import { m } from '#lib/paraglide/messages.js';
</script>

<svelte:head><title>{m.app_nome()}</title></svelte:head>

<main class="welcome">
	<div class="hero">
		<img src={asset('icon.svg')} alt="" width="88" height="88" />
		<h1>{m.app_nome()}</h1>
		<p class="lema">{m.bemvindo_lema()}</p>
	</div>
	<ul class="promises">
		<li><Icon name="no-phone" />{m.bemvindo_sem_numero()}</li>
		<li><Icon name="lock" />{m.bemvindo_no_aparelho()}</li>
		<li><Icon name="key" />{m.bemvindo_frase()}</li>
	</ul>
	<div class="bottom">
		<div class="actions stack">
			<a class="button primary" href={resolve('/cadastro')}>{m.bemvindo_criar()}</a>
			<a class="button" href={resolve('/restaurar')}>{m.bemvindo_tenho_conta()}</a>
		</div>
		<p class="hint">{m.bemvindo_teste_antes()} <a href={resolve('/teste')}>{m.bemvindo_teste_link()}</a>.</p>
	</div>
</main>

<style>
	.welcome {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
	}
	.hero {
		display: grid;
		justify-items: center;
		gap: 0.4rem;
		margin-top: 12vh;
		text-align: center;
	}
	.hero img {
		border-radius: 22%;
	}
	h1 {
		margin: 0.5rem 0 0;
		font-size: 2rem;
	}
	.lema {
		margin: 0;
		font-size: 1.1rem;
	}
	.promises {
		list-style: none;
		margin: 2.5rem 0 0;
		padding: 0;
		display: grid;
		gap: 1rem;
	}
	.promises li {
		display: flex;
		align-items: center;
		gap: 0.9rem;
	}
	.promises :global(svg) {
		flex: none;
		color: var(--accent);
	}
	/* os botões descem para perto do polegar */
	.bottom {
		margin-top: auto;
		padding-top: 2rem;
	}
	.button {
		display: flex;
		justify-content: center;
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
