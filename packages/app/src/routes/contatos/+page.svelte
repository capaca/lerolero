<script lang="ts">
	import Avatar from '#lib/components/Avatar.svelte';
	import BackLink from '#lib/components/BackLink.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { contactName, type ContactRecord, type GroupRequest, type MessageRequest } from '@lerolero/core';
	import { onMount } from 'svelte';
	import { previewText } from '#lib/notices.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { session } from '#lib/session.svelte.ts';

	type Tab = 'contatos' | 'pedidos';

	let contacts = $state.raw<ContactRecord[] | undefined>();
	let requests = $state.raw<MessageRequest[]>([]);
	let groupRequests = $state.raw<GroupRequest[]>([]);
	let blocked = $state.raw<ContactRecord[]>([]);
	const total = $derived(requests.length + groupRequests.length);
	// o ponto do ícone de Contatos abre direto os pedidos (?aba=pedidos); sem o parâmetro vale Contatos
	const tab = $derived<Tab>(page.url.searchParams.get('aba') === 'pedidos' ? 'pedidos' : 'contatos');

	function choose(next: Tab) {
		const query = next === 'pedidos' ? '?aba=pedidos' : '';
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- o caminho vem de resolve; só a aba muda
		void goto(`${resolve('/contatos')}${query}`, { replace: true, reset: false });
	}

	// setas, Home e End movem entre as abas (padrão WAI-ARIA de abas com ativação automática)
	function onTabKey(event: KeyboardEvent) {
		if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
		event.preventDefault();
		const next: Tab =
			event.key === 'Home' ? 'contatos' : event.key === 'End' ? 'pedidos' : tab === 'contatos' ? 'pedidos' : 'contatos';
		choose(next);
		document.getElementById(`aba-${next}`)?.focus();
	}

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

	<div class="tabs" role="tablist" aria-label={m.contatos_abas()}>
		<button
			id="aba-contatos"
			class="tab"
			role="tab"
			type="button"
			aria-selected={tab === 'contatos'}
			aria-controls="painel-contatos"
			tabindex={tab === 'contatos' ? 0 : -1}
			onclick={() => choose('contatos')}
			onkeydown={onTabKey}
		>
			{m.contatos_aba_contatos()}
		</button>
		<button
			id="aba-pedidos"
			class="tab"
			class:empty={total === 0}
			role="tab"
			type="button"
			aria-selected={tab === 'pedidos'}
			aria-controls="painel-pedidos"
			tabindex={tab === 'pedidos' ? 0 : -1}
			onclick={() => choose('pedidos')}
			onkeydown={onTabKey}
		>
			{total > 0 ? m.contatos_aba_pedidos_n({ count: total }) : m.contatos_aba_pedidos()}
		</button>
	</div>

	{#if tab === 'contatos'}
		<div id="painel-contatos" role="tabpanel" aria-labelledby="aba-contatos">
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
		</div>
	{:else}
		<div id="painel-pedidos" role="tabpanel" aria-labelledby="aba-pedidos">
			{#if total === 0}
				<p class="hint">{m.contatos_pedidos_vazio()}</p>
			{:else}
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
		</div>
	{/if}
</main>

<style>
	.tabs {
		display: flex;
		margin-top: 1.5rem;
		border-bottom: 1px solid var(--line);
	}
	.tab {
		flex: 1;
		padding: 0.7rem 0.5rem;
		background: none;
		border: none;
		border-bottom: 3px solid transparent;
		color: var(--fg);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	.tab[aria-selected='true'] {
		border-bottom-color: var(--accent);
	}
	/* sem pedido a aba fica no lugar, só esmaecida, para a posição não pular */
	.tab.empty:not([aria-selected='true']) {
		opacity: 0.5;
	}
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
		margin: 1rem 0;
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
