<script lang="ts">
	// Mensagens favoritas de todas as conversas (RF-28); abre pelo menu ⋮ da tela inicial.
	import BackLink from '#lib/components/BackLink.svelte';
	import StarredList from '#lib/components/StarredList.svelte';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
</script>

<svelte:head><title>{m.titulo_pagina({ pagina: m.favoritas_titulo() })}</title></svelte:head>

<main>
	<BackLink href={resolve('/')} label={m.comum_inicio()} />
	<h1>{m.favoritas_titulo()}</h1>
	<StarredList />
</main>
