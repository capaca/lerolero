<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { contactName, MAX_GROUP_MEMBERS, type ContactRecord } from '@lerolero/core';
	import { onMount } from 'svelte';
	import Avatar from '#lib/components/Avatar.svelte';
	import BackLink from '#lib/components/BackLink.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { friendlyError, session } from '#lib/session.svelte.ts';

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

	function toggle(publicKey: string) {
		error = '';
		chosen = chosen.includes(publicKey) ? chosen.filter((k) => k !== publicKey) : [...chosen, publicKey];
	}

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
			<ul class="list">
				{#each contacts as contact (contact.publicKey)}
					{@const selected = chosen.includes(contact.publicKey)}
					<li>
						<button
							type="button"
							class="person"
							class:selected
							aria-pressed={selected}
							disabled={!selected && chosen.length >= MAX_OTHERS}
							onclick={() => toggle(contact.publicKey)}
						>
							<Avatar name={contactName(contact)} publicKey={contact.publicKey} />
							<span class="text">{contactName(contact)}</span>
							<span class="tick" aria-hidden="true">{#if selected}<Icon name="check" size={16} />{/if}</span>
						</button>
					</li>
				{/each}
			</ul>
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
	.list {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.person {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		width: 100%;
		padding: 0.55rem 0;
		border: none;
		border-bottom: 1px solid var(--line);
		border-radius: 0;
		background: none;
		text-align: left;
		font-weight: 400;
	}
	.text {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tick {
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		border: 2px solid var(--line);
		flex-shrink: 0;
	}
	.selected .tick {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-fg);
	}
</style>
