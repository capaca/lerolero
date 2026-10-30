<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { groupConversationId, type ConversationRecord } from '@lerolero/core';
	import Avatar from '#lib/components/Avatar.svelte';
	import Chat from '#lib/components/Chat.svelte';
	import ChatHeader from '#lib/components/ChatHeader.svelte';
	import { memberName, type NameOf } from '#lib/notices.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { session } from '#lib/session.svelte.ts';

	const groupId = $derived(page.params.id ?? '');
	let conversation = $state.raw<ConversationRecord | null>();
	let nameOf = $state.raw<NameOf>(() => undefined);
	let contactKeys = $state.raw(new Set<string>());

	// membros, nomes e papéis mudam com os avisos de grupo
	$effect(() => {
		void session.version;
		void load(groupId);
	});

	async function load(id: string) {
		const found = (await session.getConversation(groupConversationId(id))) ?? null;
		if (found?.group) nameOf = await session.groupNames(found);
		contactKeys = new Set((await session.listContacts()).filter((c) => c.state === 'aceito').map((c) => c.publicKey));
		conversation = found;
	}

	const group = $derived(conversation?.group);
	// quem me pôs no grupo não é contato: é um pedido, com tudo fechado até eu aceitar (RF-12, T7, T18)
	const request = $derived(group?.request?.state === 'pedido' ? group.request : undefined);
	const addedBy = $derived(request?.by ? nameOf(request.by) : undefined);

	async function accept() {
		await session.acceptGroupRequest(groupConversationId(groupId));
	}
	async function block() {
		await session.blockGroupRequest(groupConversationId(groupId));
		await goto(resolve('/contatos'));
	}
	// "Você, Ana, ~Bruno": eu primeiro, depois os outros pela ordem de entrada
	const subtitle = $derived(
		group
			? group.state.members
					.map((member) => member.publicKey)
					.sort((a, b) => (a === session.identity?.publicKey ? -1 : b === session.identity?.publicKey ? 1 : 0))
					.map((key) => memberName(nameOf(key)))
					.join(', ')
			: ''
	);
</script>

<svelte:head><title>{m.titulo_pagina({ pagina: group?.state.name ?? m.grupo_titulo_pagina() })}</title></svelte:head>

{#if conversation === null}
	<main>
		<p class="hint">{m.grupo_nao_esta()}</p>
	</main>
{:else if group && group.request?.state === 'recusado'}
	<main>
		<p class="hint">{m.grupo_nao_esta()}</p>
	</main>
{:else if group}
	{#key groupId}
		<Chat
			conversationId={groupConversationId(groupId)}
			{nameOf}
			linkMode={(key) => (request ? 'texto' : contactKeys.has(key) ? 'aberto' : 'aviso')}
			closed={request ? m.grupo_pedido_fechado() : group.amMember ? undefined : m.erro_fora_do_grupo()}
		>
			{#snippet banner()}
				{#if request}
					<div class="banner notice">
						<p>
							<strong>{m.grupo_pedido_titulo()}</strong>
							{#if addedBy && !addedBy.me && !addedBy.contact}{m.grupo_pedido_por({ nome: addedBy.name })}{/if}
							{m.grupo_pedido_limites()}
						</p>
						<div class="actions">
							<button class="primary" onclick={accept}>{m.grupo_pedido_aceitar()}</button>
							<button class="danger" onclick={block}>{m.grupo_pedido_bloquear()}</button>
						</div>
					</div>
				{/if}
			{/snippet}
			{#snippet header()}
				<ChatHeader name={group.state.name} {subtitle} href={resolve('/grupo/[id]/detalhes', { id: groupId })}>
					{#snippet avatar()}
						<Avatar name={group.state.name} publicKey={groupId} size={36} group />
					{/snippet}
				</ChatHeader>
			{/snippet}
		</Chat>
	{/key}
{/if}

<style>
	.danger {
		background: var(--danger);
		border-color: var(--danger);
		color: var(--danger-fg);
	}
	.notice {
		margin: 0.6rem 1rem 0;
	}
</style>
