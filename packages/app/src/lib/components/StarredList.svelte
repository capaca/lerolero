<script lang="ts">
	// Lista de mensagens favoritas (RF-28): de todas as conversas (tela Favoritas) ou de uma só (detalhes do contato
	// ou do grupo). O toque abre a conversa já na mensagem.
	import Avatar from './Avatar.svelte';
	import Icon from './Icon.svelte';
	import { resolve } from '$app/paths';
	import { formatWhen } from '#lib/format.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { session } from '#lib/session.svelte.ts';

	let { conversationId }: { conversationId?: string } = $props();

	let items = $state.raw<Awaited<ReturnType<typeof session.listStarred>>>();
	$effect(() => {
		void session.version;
		void session.listStarred(conversationId).then((list) => (items = list));
	});

	// a mensagem vai na query: a conversa abre rolada até ela
	const hrefOf = (item: NonNullable<typeof items>[number]) =>
		`${item.direct ? resolve('/conversa/[chave]', { chave: item.key }) : resolve('/grupo/[id]', { id: item.key })}?msg=${item.message.id}`;
</script>

{#if items && !items.length}
	<p class="hint">{conversationId ? m.favoritas_vazia_conversa() : m.favoritas_vazia()}</p>
{/if}
<ul class="starred">
	{#each items ?? [] as item (item.message.id)}
		{@const msg = item.message}
		<li>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- o caminho vem de resolve; só a query muda -->
			<a href={hrefOf(item)}>
				{#if !conversationId}<Avatar name={item.title} publicKey={item.key} group={!item.direct} />{/if}
				<span class="text">
					<span class="top">
						<strong>{conversationId ? item.author : item.title}</strong>
						<span class="when"><Icon name="star" size={12} /> {formatWhen(msg.createdAt)}</span>
					</span>
					<span class="preview">
						{#if !conversationId && item.author && !item.direct}<span class="author">{item.author}:</span>{/if}
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
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		color: var(--muted);
		font-size: 0.8rem;
		white-space: nowrap;
	}
	.when :global(svg) {
		fill: currentColor;
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
	.author {
		font-weight: 600;
	}
</style>
