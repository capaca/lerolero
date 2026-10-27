<script lang="ts">
	// Frase traduzida com negrito e ícones no meio (ver `richParts`): o texto fica inteiro no arquivo de mensagens.
	// Com `href`, os trechos em negrito viram o link; `external` abre numa aba nova.
	import { richParts } from '#lib/i18n.svelte.ts';
	import Icon from './Icon.svelte';

	let { text, href, external = false }: { text: string; href?: string; external?: boolean } = $props();
</script>

{#each richParts(text) as part, i (i)}{#if part.icon}<span class="icon"><Icon name={part.icon} size={14} /></span
		>{:else if part.bold && href}<a
			{href}
			target={external ? '_blank' : undefined}
			rel={external ? 'noopener noreferrer' : undefined}>{part.text}</a
		>{:else if part.bold}<strong>{part.text}</strong>{:else}{part.text}{/if}{/each}

<style>
	.icon {
		display: inline-block;
		vertical-align: -2px;
	}
</style>
