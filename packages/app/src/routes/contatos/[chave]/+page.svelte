<script lang="ts">
	import BackLink from '#lib/components/BackLink.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
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

		{#if contact.state === 'bloqueado'}
			<p class="hint">Você bloqueou esta pessoa: o que ela mandar é descartado, sem aviso.</p>
			<div class="actions">
				<button onclick={unblock}>Desbloquear</button>
			</div>
		{:else}
			<div class="actions">
				<a class="primary-link" href={resolve('/conversa/[chave]', { chave: contact.publicKey })}>Conversar</a>
				<button class="danger" onclick={() => (confirmingBlock = true)}>Bloquear</button>
			</div>
		{/if}

		{#if confirmingBlock}
			<Sheet label="Bloquear" onclose={() => (confirmingBlock = false)}>
				<p><strong>Bloquear {contactName(contact)}?</strong></p>
				<p class="hint">
					A conversa some deste aparelho e o que essa pessoa mandar daqui para frente é descartado, sem aviso a ela. Você
					pode desbloquear depois, em Contatos; as mensagens de antes não voltam.
				</p>
				<div class="actions">
					<button onclick={() => (confirmingBlock = false)}>Cancelar</button>
					<button class="danger" onclick={block}>Bloquear</button>
				</div>
			</Sheet>
		{/if}
	{/if}
</main>

<style>
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
	.key {
		font-family: ui-monospace, monospace;
		font-size: 0.8rem;
		overflow-wrap: anywhere;
	}
</style>
