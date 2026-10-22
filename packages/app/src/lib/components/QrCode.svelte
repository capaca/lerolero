<script lang="ts">
	import { renderSVG } from 'uqr';

	let { text, label }: { text: string; label: string } = $props();

	// preto no branco mesmo no tema escuro: câmeras leem melhor assim
	const svg = $derived(renderSVG(text, { border: 2, ecc: 'M' }));
</script>

<div class="qr" role="img" aria-label={label}>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG gerado localmente pela uqr a partir do nosso próprio link -->
	{@html svg}
</div>

<style>
	.qr {
		background: white;
		border-radius: 12px;
		padding: 8px;
		max-width: 320px;
		margin: 1rem auto;
	}
	.qr :global(svg) {
		display: block;
		width: 100%;
		height: auto;
	}
</style>
