<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { contactName, directConversationId, toNpub, type ContactRecord } from '@lerolero/core';
	import Avatar from '#lib/components/Avatar.svelte';
	import Chat from '#lib/components/Chat.svelte';
	import ChatHeader from '#lib/components/ChatHeader.svelte';
	import { session } from '#lib/session.svelte.ts';

	const publicKey = $derived(page.params.chave ?? '');
	let contact = $state.raw<ContactRecord | null>();

	// o nome pode mudar quando chega a primeira mensagem (tag "nome")
	$effect(() => {
		void session.version;
		void session.getContact(publicKey).then((c) => (contact = c ?? null));
	});

	const name = $derived(contact ? contactName(contact) : contact === null ? `${toNpub(publicKey).slice(0, 12)}…` : '');
	const isContact = $derived(contact?.state === 'aceito');
	const inviteHash = $derived(`#${toNpub(publicKey)}${contact?.chosenName ? `&n=${encodeURIComponent(contact.chosenName)}` : ''}`);
</script>

<svelte:head><title>{name || 'Conversa'} · Lero-lero</title></svelte:head>

{#key publicKey}
	<!-- quem ainda não é contato é um pedido de mensagem: o endereço continua texto (T7, T18) -->
	<Chat conversationId={directConversationId(publicKey)} linkMode={() => (isContact ? 'aberto' : 'texto')}>
		{#snippet header()}
			<ChatHeader {name} href={isContact ? resolve('/contatos/[chave]', { chave: publicKey }) : undefined}>
				{#snippet avatar()}
					<Avatar name={isContact && contact ? contactName(contact) : undefined} {publicKey} size={36} />
				{/snippet}
			</ChatHeader>
		{/snippet}
		{#snippet banner()}
			{#if contact !== undefined && !isContact}
				<div class="banner notice">
					<p>
						<strong>Esta pessoa não está nos seus contatos.</strong>
						{#if contact?.chosenName}Ela se apresenta como “{contact.chosenName}”, mas qualquer um pode escolher qualquer nome.{/if}
					</p>
					<a href={resolve('/convite') + inviteHash}>Adicionar aos contatos</a>
				</div>
			{/if}
		{/snippet}
	</Chat>
{/key}

<style>
	.notice {
		margin: 0.6rem 1rem 0;
	}
</style>
