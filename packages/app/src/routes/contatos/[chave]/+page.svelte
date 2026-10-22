<script lang="ts">
	import BackLink from '#lib/components/BackLink.svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { contactName, toNpub, type ContactRecord } from '@lerolero/core';
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

	async function rename(event: SubmitEvent) {
		event.preventDefault();
		contact = await session.renameContact(contact!.publicKey, localName);
		saved = true;
	}
</script>

<svelte:head><title>{contact ? contactName(contact) : 'Contato'} · Lero-lero</title></svelte:head>

<main>
	<BackLink href={resolve('/contatos')} label="Contatos" />
	{#if contact === null}
		<p>Contato não encontrado.</p>
	{:else if contact}
		<h1>{contactName(contact)}</h1>
		{#if contact.chosenName}
			<p class="hint">Se apresenta como “{contact.chosenName}”.</p>
		{/if}
		<p class="hint key">{toNpub(contact.publicKey)}</p>

		<form onsubmit={rename}>
			<label for="nome">Nome que você deu</label>
			<input id="nome" maxlength="40" autocomplete="off" bind:value={localName} oninput={() => (saved = false)} />
			<div class="actions">
				<button type="submit">Salvar nome</button>
				{#if saved}<span role="status" class="hint">Salvo.</span>{/if}
			</div>
		</form>

		<div class="actions">
			<a class="primary-link" href={resolve('/conversa/[chave]', { chave: contact.publicKey })}>Conversar</a>
		</div>
	{/if}
</main>

<style>
	.primary-link {
		display: inline-block;
		text-decoration: none;
		font-weight: 600;
		padding: 0.75rem 1.1rem;
		border-radius: 10px;
		background: var(--accent);
		color: var(--accent-fg);
	}
	.key {
		font-family: ui-monospace, monospace;
		font-size: 0.8rem;
		overflow-wrap: anywhere;
	}
</style>
