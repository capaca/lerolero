<script lang="ts">
	import { resolve } from '$app/paths';
	import { contactName, type ContactRecord } from '@lerolero/core';
	import { onMount } from 'svelte';
	import { session } from '#lib/session.svelte.ts';

	let contacts = $state.raw<ContactRecord[] | undefined>();
	onMount(async () => (contacts = await session.listContacts()));
</script>

<svelte:head><title>Contatos · Lero-lero</title></svelte:head>

<main>
	<p><a href={resolve('/')}>← Início</a></p>
	<h1>Contatos</h1>

	<div class="actions">
		<a class="button primary" href={resolve('/contatos/ler')}>Adicionar contato</a>
		<a class="button" href={resolve('/contatos/meu-convite')}>Meu convite</a>
	</div>

	{#if contacts === undefined}
		<p class="hint">Carregando…</p>
	{:else if contacts.length === 0}
		<p class="hint">
			Para adicionar alguém, leia o QR code da pessoa ou abra o link de convite que ela mandou. Para ser
			adicionado, mostre ou mande o seu convite.
		</p>
	{:else}
		<ul class="list">
			{#each contacts as contact (contact.publicKey)}
				<li>
					<a href={resolve('/contatos/[chave]', { chave: contact.publicKey })}>
						<strong>{contactName(contact)}</strong>
						{#if contact.localName && contact.chosenName && contact.localName !== contact.chosenName}
							<span class="hint">se apresenta como “{contact.chosenName}”</span>
						{/if}
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	.button {
		text-decoration: none;
		font-weight: 600;
		padding: 0.7rem 1rem;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--fg);
	}
	.button.primary {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-fg);
	}
	.list {
		list-style: none;
		padding: 0;
		margin: 1.5rem 0;
	}
	.list li a {
		display: flex;
		flex-direction: column;
		padding: 0.8rem 0;
		border-bottom: 1px solid var(--line);
		color: var(--fg);
		text-decoration: none;
	}
</style>
