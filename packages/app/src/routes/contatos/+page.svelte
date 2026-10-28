<script lang="ts">
	import Avatar from '#lib/components/Avatar.svelte';
	import BackLink from '#lib/components/BackLink.svelte';
	import { resolve } from '$app/paths';
	import { contactName, type ContactRecord, type GroupRequest, type MessageRequest } from '@lerolero/core';
	import { onMount } from 'svelte';
	import { previewText } from '#lib/notices.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { session } from '#lib/session.svelte.ts';

	let contacts = $state.raw<ContactRecord[] | undefined>();
	let requests = $state.raw<MessageRequest[]>([]);
	let groupRequests = $state.raw<GroupRequest[]>([]);
	let blocked = $state.raw<ContactRecord[]>([]);
	onMount(async () => {
		[contacts, requests, groupRequests, blocked] = await Promise.all([
			session.listContacts(),
			session.listRequests(),
			session.listGroupRequests(),
			session.listBlocked()
		]);
	});
</script>

<svelte:head><title>{m.titulo_pagina({ pagina: m.contatos_titulo() })}</title></svelte:head>

<main>
	<BackLink href={resolve('/')} label={m.comum_inicio()} />
	<h1>{m.contatos_titulo()}</h1>

	<div class="actions">
		<a class="button primary" href={resolve('/contatos/ler')}>{m.contatos_adicionar()}</a>
		<a class="button" href={resolve('/contatos/meu-convite')}>{m.contatos_meu_convite()}</a>
	</div>

	{#if requests.length + groupRequests.length > 0}
		<section>
			<h2>{m.contatos_pedidos({ count: requests.length + groupRequests.length })}</h2>
			<p class="hint">{m.contatos_pedidos_dica()}</p>
			<ul class="list">
				{#each groupRequests as { conversation, by } (conversation.id)}
					{@const id = conversation.id.slice('grupo:'.length)}
					<li>
						<a href={resolve('/grupo/[id]', { id })}>
							<Avatar name={conversation.group?.state.name} publicKey={id} group />
							<span class="text">
								<strong>{conversation.group?.state.name}</strong>
								<span class="hint preview">
									{by ? m.contatos_grupo_por({ nome: `~${contactName(by)}` }) : m.contatos_grupo_por_desconhecido()}
								</span>
							</span>
						</a>
					</li>
				{/each}
				{#each requests as { contact, conversation } (contact.publicKey)}
					<li>
						<a href={resolve('/conversa/[chave]', { chave: contact.publicKey })}>
							<Avatar name={contactName(contact)} publicKey={contact.publicKey} />
							<span class="text">
								<strong>~{contactName(contact)}</strong>
								<span class="hint preview">{previewText(conversation)}</span>
							</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if contacts === undefined}
		<p class="hint">{m.comum_carregando()}</p>
	{:else if contacts.length === 0}
		<p class="hint">{m.contatos_vazio()}</p>
	{:else}
		<ul class="list">
			{#each contacts as contact (contact.publicKey)}
				<li>
					<a href={resolve('/contatos/[chave]', { chave: contact.publicKey })}>
						<Avatar name={contactName(contact)} publicKey={contact.publicKey} />
						<span class="text">
							<strong>{contactName(contact)}</strong>
							{#if contact.localName && contact.chosenName && contact.localName !== contact.chosenName}
								<span class="hint">{m.contatos_se_apresenta({ nome: contact.chosenName })}</span>
							{/if}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}

	{#if blocked.length > 0}
		<section>
			<h2>{m.contatos_bloqueados({ count: blocked.length })}</h2>
			<ul class="list">
				{#each blocked as contact (contact.publicKey)}
					<li>
						<a href={resolve('/contatos/[chave]', { chave: contact.publicKey })}>
							<Avatar name={contactName(contact)} publicKey={contact.publicKey} />
							<span class="text"><strong>{contactName(contact)}</strong></span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</main>

<style>
	.preview {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
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
		align-items: center;
		gap: 0.8rem;
		padding: 0.6rem 0;
		border-bottom: 1px solid var(--line);
		color: var(--fg);
		text-decoration: none;
	}
	.text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
</style>
