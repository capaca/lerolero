<script lang="ts">
	// Mensagens favoritas (RF-28): a lista de todas as conversas; o toque abre a conversa de onde vieram.
	import Avatar from '#lib/components/Avatar.svelte';
	import BackLink from '#lib/components/BackLink.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { resolve } from '$app/paths';
	import { formatWhen } from '#lib/format.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { session } from '#lib/session.svelte.ts';

	let items = $state.raw<Awaited<ReturnType<typeof session.listStarred>>>();
	$effect(() => {
		void session.version;
		void session.listStarred().then((list) => (items = list));
	});
</script>

<svelte:head><title>{m.titulo_pagina({ pagina: m.favoritas_titulo_pagina() })}</title></svelte:head>

<main>
	<BackLink href={resolve('/ajustes')} label={m.inicio_ajustes()} />
	<h1>{m.ajustes_favoritas()}</h1>

	{#if items && !items.length}
		<p class="hint">{m.favoritas_vazia()}</p>
	{/if}
	<ul class="starred">
		{#each items ?? [] as item (item.message.id)}
			{@const msg = item.message}
			<li>
				<a href={item.direct ? resolve('/conversa/[chave]', { chave: item.key }) : resolve('/grupo/[id]', { id: item.key })}>
					<Avatar name={item.title} publicKey={item.key} group={!item.direct} />
					<span class="text">
						<span class="top"><strong>{item.title}</strong><span class="when">{formatWhen(msg.createdAt)}</span></span>
						<span class="preview">
							{#if msg.media?.type.startsWith('audio/')}
								<Icon name="mic" size={15} /> {m.previa_audio()}
							{:else if msg.media?.type.startsWith('image/')}
								<Icon name="image" size={15} /> {m.previa_foto()}
							{:else if msg.media}
								<Icon name="paperclip" size={15} />
							{:else}
								{msg.text}
							{/if}
						</span>
					</span>
				</a>
			</li>
		{/each}
	</ul>
</main>

<style>
	.starred {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	a {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		padding: 0.7rem 0;
		border-bottom: 1px solid var(--line);
		color: inherit;
		text-decoration: none;
	}
	.text {
		flex: 1;
		min-width: 0;
	}
	.top {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.when {
		color: var(--muted);
		font-size: 0.8rem;
	}
	.preview {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		color: var(--muted);
		overflow-wrap: anywhere;
	}
</style>
