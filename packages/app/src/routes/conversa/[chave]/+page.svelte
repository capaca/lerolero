<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { contactName, directConversationId, toNpub, type ContactRecord } from '@lerolero/core';
	import Avatar from '#lib/components/Avatar.svelte';
	import Chat from '#lib/components/Chat.svelte';
	import ChatHeader from '#lib/components/ChatHeader.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { phraseOfferDue } from '#lib/phrase-reminder.ts';
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
	async function accept() {
		await session.acceptRequest(publicKey);
		// aceitar o primeiro contato também é a hora de guardar a frase (Q-U1), como ao adicionar pelo convite
		if (await phraseOfferDue()) await goto(resolve('/guardar-frase') + '?contato=' + publicKey, { replaceState: true });
	}
	async function block() {
		await session.blockContact(publicKey);
		await goto(resolve('/contatos'));
	}
</script>

<svelte:head><title>{m.titulo_pagina({ pagina: name || m.conversa_titulo_pagina() })}</title></svelte:head>

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
						<strong>{m.conversa_pedido_titulo()}</strong>
						{#if contact?.chosenName}{m.conversa_pedido_nome({ nome: contact.chosenName })}{/if}
						{m.conversa_pedido_limites()}
					</p>
					<div class="actions">
						<button class="primary" onclick={accept}>{m.conversa_pedido_aceitar()}</button>
						<button class="danger" onclick={block}>{m.conversa_pedido_bloquear()}</button>
					</div>
				</div>
			{/if}
		{/snippet}
	</Chat>
{/key}

<style>
	.danger {
		background: var(--danger);
		border-color: var(--danger);
		color: white;
	}
	.notice {
		margin: 0.6rem 1rem 0;
	}
</style>
