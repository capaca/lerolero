<script lang="ts">
	// Mensagens favoritas de todas as conversas (RF-28); abre pela estrela na barra da tela inicial.
	import TopBar from '#lib/components/TopBar.svelte';
	import StarredList from '#lib/components/StarredList.svelte';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
</script>

<svelte:head><title>{m.titulo_pagina({ pagina: m.favoritas_titulo() })}</title></svelte:head>

<TopBar title={m.favoritas_titulo()} back={resolve('/')} backTo={m.comum_inicio()} />

<main>
	<StarredList />
</main>
