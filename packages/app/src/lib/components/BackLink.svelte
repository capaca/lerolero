<script lang="ts">
	// Link de voltar do topo das telas, com a seta desenhada.
	import Icon from './Icon.svelte';

	let { href, label }: { href: string; label: string } = $props();
</script>

<p class="back"><a {href}><Icon name="back" size={18} /><span>{label}</span></a></p>

<style>
	.back {
		margin: 0.25rem 0 0.75rem;
	}
	a {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		text-decoration: none;
		font-weight: 600;
	}
</style>
