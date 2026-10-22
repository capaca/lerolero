<script lang="ts">
	import { page } from '$app/state';
	import { groupConversationId, type ConversationRecord } from '@lerolero/core';
	import Avatar from '#lib/components/Avatar.svelte';
	import Chat from '#lib/components/Chat.svelte';
	import ChatHeader from '#lib/components/ChatHeader.svelte';
	import { session } from '#lib/session.svelte.ts';

	const groupId = $derived(page.params.id ?? '');
	let conversation = $state.raw<ConversationRecord | null>();
	let nameOf = $state.raw<(publicKey: string) => string>(() => '');

	// membros, nomes e papéis mudam com os avisos de grupo
	$effect(() => {
		void session.version;
		void load(groupId);
	});

	async function load(id: string) {
		const found = (await session.getConversation(groupConversationId(id))) ?? null;
		if (found?.group) nameOf = await session.groupNames(found);
		conversation = found;
	}

	const group = $derived(conversation?.group);
	// "Você, Ana, ~Bruno": eu primeiro, depois os outros pela ordem de entrada
	const subtitle = $derived(
		group
			? group.state.members
					.map((m) => m.publicKey)
					.sort((a, b) => (a === session.identity?.publicKey ? -1 : b === session.identity?.publicKey ? 1 : 0))
					.map(nameOf)
					.join(', ')
			: ''
	);
</script>

<svelte:head><title>{group?.state.name ?? 'Grupo'} · Lero-lero</title></svelte:head>

{#if conversation === null}
	<main>
		<p class="hint">Este grupo não está neste aparelho.</p>
	</main>
{:else if group}
	{#key groupId}
		<Chat
			conversationId={groupConversationId(groupId)}
			{nameOf}
			closed={group.amMember ? undefined : 'Você não faz mais parte deste grupo.'}
		>
			{#snippet header()}
				<ChatHeader name={group.state.name} {subtitle}>
					{#snippet avatar()}
						<Avatar name={group.state.name} publicKey={groupId} size={36} group />
					{/snippet}
				</ChatHeader>
			{/snippet}
		</Chat>
	{/key}
{/if}
