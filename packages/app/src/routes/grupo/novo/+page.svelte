<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { contactName, MAX_GROUP_MEMBERS, type ContactRecord } from '@lerolero/core';
	import { onMount } from 'svelte';
	import BackLink from '#lib/components/BackLink.svelte';
	import ContactPicker from '#lib/components/ContactPicker.svelte';
	import { friendlyError } from '#lib/errors.ts';
	import { intlLocale } from '#lib/i18n.svelte.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { session } from '#lib/session.svelte.ts';

	// eu também conto no limite de 20 (RF-30)
	const MAX_OTHERS = MAX_GROUP_MEMBERS - 1;

	let contacts = $state.raw<ContactRecord[]>();
	let name = $state('');
	let chosen = $state<string[]>([]);
	let error = $state('');
	let creating = $state(false);

	onMount(async () => {
		const all = await session.listContacts();
		contacts = all.filter((c) => c.state === 'aceito').sort((a, b) => contactName(a).localeCompare(contactName(b), intlLocale()));
	});

	async function create(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		if (!name.trim()) return void (error = m.grupo_erro_nome());
		if (chosen.length === 0) return void (error = m.grupo_erro_ninguem());
		creating = true;
		try {
			const id = await session.createGroup(name, chosen);
			await goto(resolve('/grupo/[id]', { id: id.slice('grupo:'.length) }), { replaceState: true });
		} catch (err) {
			error = friendlyError(err);
			creating = false;
		}
	}
</script>

<svelte:head><title>{m.titulo_pagina({ pagina: m.inicio_novo_grupo() })}</title></svelte:head>

<main>
	<BackLink href={resolve('/')} label={m.comum_inicio()} />
	<h1>{m.inicio_novo_grupo()}</h1>

	<form onsubmit={create}>
		<label for="nome">{m.grupo_nome_rotulo()}</label>
		<input id="nome" bind:value={name} oninput={() => (error = '')} maxlength="60" autocomplete="off" placeholder={m.grupo_nome_placeholder()} />

		<h2>{m.grupo_quem_participa()} <span class="count">{m.grupo_contagem({ count: chosen.length, max: MAX_OTHERS })}</span></h2>
		{#if contacts === undefined}
			<p class="hint">{m.comum_carregando()}</p>
		{:else if contacts.length === 0}
			<p class="hint">{m.grupo_sem_contatos()}</p>
			<div class="actions">
				<a href={resolve('/contatos/meu-convite')}>{m.inicio_convidar()}</a>
			</div>
		{:else}
			<ContactPicker {contacts} bind:chosen max={MAX_OTHERS} onchange={() => (error = '')} />
		{/if}

		<p class="hint">{m.grupo_nomes_dica()}</p>

		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<div class="actions">
			<button class="primary" type="submit" disabled={creating || !contacts?.length}>
				{creating ? m.grupo_criando() : m.grupo_criar()}
			</button>
		</div>
	</form>
</main>

<style>
	h2 {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin: 1.5rem 0 0.5rem;
	}
	.count {
		font-size: 0.85rem;
		font-weight: 400;
		color: var(--muted);
	}
</style>
