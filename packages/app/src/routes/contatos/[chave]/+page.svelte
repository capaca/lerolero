<script lang="ts">
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
	<p><a href={resolve('/contatos')}>← Contatos</a></p>
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

		<div class="card">
			<p class="hint">Conversar com {contactName(contact)} chega na etapa de mensagens.</p>
		</div>
	{/if}
</main>

<style>
	.key {
		font-family: ui-monospace, monospace;
		font-size: 0.8rem;
		overflow-wrap: anywhere;
	}
</style>
