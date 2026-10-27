<script lang="ts">
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
{:else if group}
	{#key groupId}
		<Chat
			conversationId={groupConversationId(groupId)}
			{nameOf}
			linkMode={(key) => (contactKeys.has(key) ? 'aberto' : 'aviso')}
			closed={group.amMember ? undefined : m.erro_fora_do_grupo()}
		>
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
