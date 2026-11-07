<script lang="ts">
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import TopBar from '#lib/components/TopBar.svelte';
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

	// renomear pelo lápis, como o nome do grupo (item 26)
	let editing = $state(false);
	function startRename() {
		localName = contact?.localName ?? '';
		saved = false;
		editing = true;
	}
	async function rename(event: SubmitEvent) {
		event.preventDefault();
		contact = await session.renameContact(contact!.publicKey, localName);
		editing = false;
		saved = true;
	}
</script>

<svelte:head><title>{m.titulo_pagina({ pagina: contact ? contactName(contact) : m.contato_titulo_pagina() })}</title></svelte:head>

<TopBar back={resolve('/contatos')} backTo={m.contatos_titulo()} />

<main>
	{#if contact === null}
		<p>{m.contato_nao_encontrado()}</p>
	{:else if contact}
		<div class="top">
			<Avatar name={contactName(contact)} publicKey={contact.publicKey} size={96} />
			{#if editing}
				<form class="rename" onsubmit={rename}>
					<label for="nome">{m.contato_nome_rotulo()}</label>
					<!-- svelte-ignore a11y_autofocus -->
					<input id="nome" maxlength="40" autocomplete="off" autofocus bind:value={localName} />
					<div class="actions">
						<button type="button" onclick={() => (editing = false)}>{m.comum_cancelar()}</button>
						<button class="primary" type="submit">{m.comum_salvar()}</button>
					</div>
				</form>
			{:else}
				<!-- o lápis fica fora do título, para o nome dele ser só o do contato -->
				<div class="name">
					<h1>{contactName(contact)}</h1>
					<button class="icon" onclick={startRename} aria-label={m.contato_mudar_nome()}><Icon name="pencil" size={18} /></button>
				</div>
				{#if contact.chosenName}
					<p class="hint">{m.contato_se_apresenta({ nome: contact.chosenName })}</p>
				{/if}
				{#if saved}<p role="status" class="hint">{m.contato_salvo()}</p>{/if}
			{/if}
			<p class="hint key">{toNpub(contact.publicKey)}</p>
		</div>

		{#if contact.state === 'bloqueado'}
			<p class="hint">{m.contato_bloqueado_dica()}</p>
			<div class="actions">
				<button onclick={unblock}>{m.contato_desbloquear()}</button>
			</div>
		{:else}
			<a class="primary-link" href={resolve('/conversa/[chave]', { chave: contact.publicKey })}>{m.contato_conversar()}</a>
		{/if}

		<section class="favorites">
			<h2>{m.favoritas_titulo()}</h2>
			<StarredList conversationId={directConversationId(contact.publicKey)} />
		</section>

		<!-- no fim, como "Sair do grupo" (item 26) -->
		{#if contact.state !== 'bloqueado'}
			<button class="danger-row" onclick={() => (confirmingBlock = true)}><Icon name="ban" /> {m.contato_bloquear()}</button>
		{/if}

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
	.top {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		margin: 0.5rem 0 1rem;
	}
	.name {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		margin: 0.8rem 0 0.2rem;
	}
	h1 {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.top .hint {
		margin: 0.2rem 0;
	}
	.rename {
		width: 100%;
		text-align: left;
		margin-top: 1rem;
	}
	/* alvo de toque de 48 px (RNF-63) sem engordar a linha do nome */
	.icon {
		display: grid;
		place-items: center;
		width: 3rem;
		height: 3rem;
		margin: -0.5rem 0;
		padding: 0;
		border: none;
		background: none;
		color: var(--muted);
	}
	.danger {
		background: var(--danger);
		border-color: var(--danger);
		color: var(--danger-fg);
	}
	.primary-link {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 3rem;
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
