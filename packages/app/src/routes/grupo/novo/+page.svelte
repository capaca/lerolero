<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { contactName, MAX_GROUP_MEMBERS, type ContactRecord } from '@lerolero/core';
	import { onMount } from 'svelte';
	import BackLink from '#lib/components/BackLink.svelte';
	import ContactPicker from '#lib/components/ContactPicker.svelte';
	import { friendlyError } from '#lib/errors.ts';
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
		contacts = all.filter((c) => c.state === 'aceito').sort((a, b) => contactName(a).localeCompare(contactName(b), 'pt-BR'));
	});

	async function create(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		if (!name.trim()) return void (error = 'Dê um nome ao grupo.');
		if (chosen.length === 0) return void (error = 'Escolha pelo menos uma pessoa.');
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

<svelte:head><title>Novo grupo · Lero-lero</title></svelte:head>

<main>
	<BackLink href={resolve('/')} label="Início" />
	<h1>Novo grupo</h1>

	<form onsubmit={create}>
		<label for="nome">Nome do grupo</label>
		<input id="nome" bind:value={name} oninput={() => (error = '')} maxlength="60" autocomplete="off" placeholder="Ex.: Família" />

		<h2>Quem participa <span class="count">{chosen.length} de {MAX_OTHERS}</span></h2>
		{#if contacts === undefined}
			<p class="hint">Carregando…</p>
		{:else if contacts.length === 0}
			<p class="hint">
				Você ainda não tem contatos. Para criar um grupo, primeiro adicione as pessoas pelo QR code ou pelo link de
				convite.
			</p>
			<div class="actions">
				<a href={resolve('/contatos/meu-convite')}>Convidar alguém</a>
			</div>
		{:else}
			<ContactPicker {contacts} bind:chosen max={MAX_OTHERS} onchange={() => (error = '')} />
		{/if}

		<p class="hint">
			Os nomes que você deu aos seus contatos ficam só com você. No grupo, cada pessoa aparece com o nome que ela
			mesma escolheu.
		</p>

		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<div class="actions">
			<button class="primary" type="submit" disabled={creating || !contacts?.length}>
				{creating ? 'Criando…' : 'Criar grupo'}
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
