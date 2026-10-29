<script lang="ts">
	import Avatar from '#lib/components/Avatar.svelte';
	import BackLink from '#lib/components/BackLink.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import StarredList from '#lib/components/StarredList.svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { contactName, directConversationId, toNpub, type ContactRecord } from '@lerolero/core';
	import { m } from '#lib/paraglide/messages.js';
	import { session } from '#lib/session.svelte.ts';

	let contact = $state.raw<ContactRecord | null>();
	let localName = $state('');
	let saved = $state(false);

	$effect(() => {
		void session.getContact(page.params.chave ?? '').then((c) => {
			contact = c ?? null;
			localName = c?.localName ?? '';
		});
	});

	let confirmingBlock = $state(false);

	async function block() {
		confirmingBlock = false;
		await session.blockContact(contact!.publicKey);
		contact = await session.getContact(contact!.publicKey);
	}

	async function unblock() {
		await session.unblockContact(contact!.publicKey);
		contact = await session.getContact(contact!.publicKey);
	}

	async function rename(event: SubmitEvent) {
		event.preventDefault();
		contact = await session.renameContact(contact!.publicKey, localName);
		saved = true;
	}
</script>

<svelte:head><title>{m.titulo_pagina({ pagina: contact ? contactName(contact) : m.contato_titulo_pagina() })}</title></svelte:head>

<main>
	<BackLink href={resolve('/contatos')} label={m.contatos_titulo()} />
	{#if contact === null}
		<p>{m.contato_nao_encontrado()}</p>
	{:else if contact}
		<div class="photo"><Avatar name={contactName(contact)} publicKey={contact.publicKey} size={96} /></div>
		<h1>{contactName(contact)}</h1>
		{#if contact.chosenName}
			<p class="hint">{m.contato_se_apresenta({ nome: contact.chosenName })}</p>
		{/if}
		<p class="hint key">{toNpub(contact.publicKey)}</p>

		<form onsubmit={rename}>
			<label for="nome">{m.contato_nome_rotulo()}</label>
			<input id="nome" maxlength="40" autocomplete="off" bind:value={localName} oninput={() => (saved = false)} />
			<div class="actions">
				<button type="submit">{m.contato_salvar_nome()}</button>
				{#if saved}<span role="status" class="hint">{m.contato_salvo()}</span>{/if}
			</div>
		</form>

		{#if contact.state === 'bloqueado'}
			<p class="hint">{m.contato_bloqueado_dica()}</p>
			<div class="actions">
				<button onclick={unblock}>{m.contato_desbloquear()}</button>
			</div>
		{:else}
			<div class="actions">
				<a class="primary-link" href={resolve('/conversa/[chave]', { chave: contact.publicKey })}>{m.contato_conversar()}</a>
				<button class="danger" onclick={() => (confirmingBlock = true)}>{m.contato_bloquear()}</button>
			</div>
		{/if}

		<section class="favorites">
			<h2>{m.favoritas_titulo()}</h2>
			<StarredList conversationId={directConversationId(contact.publicKey)} />
		</section>

		{#if confirmingBlock}
			<Sheet label={m.contato_bloquear()} onclose={() => (confirmingBlock = false)}>
				<p><strong>{m.contato_bloquear_pergunta({ nome: contactName(contact) })}</strong></p>
				<p class="hint">{m.contato_bloquear_dica()}</p>
				<div class="actions">
					<button onclick={() => (confirmingBlock = false)}>{m.comum_cancelar()}</button>
					<button class="danger" onclick={block}>{m.contato_bloquear()}</button>
				</div>
			</Sheet>
		{/if}
	{/if}
</main>

<style>
	.photo {
		margin-top: 0.5rem;
	}
	.danger {
		background: var(--danger);
		border-color: var(--danger);
		color: white;
	}
	.primary-link {
		display: inline-block;
		text-decoration: none;
		font-weight: 600;
		padding: 0.75rem 1.1rem;
		border-radius: 10px;
		background: var(--accent);
		color: var(--accent-fg);
	}
	.favorites {
		margin-top: 1.5rem;
	}
	.key {
		font-family: ui-monospace, monospace;
		font-size: 0.8rem;
		overflow-wrap: anywhere;
	}
</style>
