<script lang="ts">
	// Adicionar pessoas a um grupo (RF-31): só contatos aceitos que ainda não estão nele.
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { contactName, groupConversationId, MAX_GROUP_MEMBERS, type ContactRecord, type GroupState } from '@lerolero/core';
	import BackLink from '#lib/components/BackLink.svelte';
	import ContactPicker from '#lib/components/ContactPicker.svelte';
	import { friendlyError } from '#lib/errors.ts';
	import { session } from '#lib/session.svelte.ts';

	const groupId = $derived(page.params.id ?? '');
	const conversationId = $derived(groupConversationId(groupId));

	let groupState = $state.raw<GroupState>();
	let contacts = $state.raw<ContactRecord[]>();
	let chosen = $state<string[]>([]);
	let error = $state('');
	let adding = $state(false);

	$effect(() => {
		void load(conversationId);
	});

	async function load(id: string) {
		const [conversation, all] = await Promise.all([session.getConversation(id), session.listContacts()]);
		groupState = conversation?.group?.state;
		const inGroup = new Set(groupState?.members.map((m) => m.publicKey));
		contacts = all
			.filter((c) => c.state === 'aceito' && !inGroup.has(c.publicKey))
			.sort((a, b) => contactName(a).localeCompare(contactName(b), 'pt-BR'));
	}

	const room = $derived(groupState ? MAX_GROUP_MEMBERS - groupState.members.length : 0);

	async function add(event: SubmitEvent) {
		event.preventDefault();
		if (chosen.length === 0) return void (error = 'Escolha pelo menos uma pessoa.');
		error = '';
		adding = true;
		try {
			await session.addToGroup(conversationId, chosen);
			await goto(resolve('/grupo/[id]/detalhes', { id: groupId }), { replaceState: true });
		} catch (err) {
			error = friendlyError(err);
			adding = false;
		}
	}
</script>

<svelte:head><title>Adicionar pessoas · Lero-lero</title></svelte:head>

<main>
	<BackLink href={resolve('/grupo/[id]/detalhes', { id: groupId })} label={groupState?.name ?? 'Grupo'} />
	<h1>Adicionar pessoas</h1>

	<form onsubmit={add}>
		{#if contacts === undefined}
			<p class="hint">Carregando…</p>
		{:else if contacts.length === 0}
			<p class="hint">
				Todos os seus contatos já estão no grupo. Para adicionar outra pessoa, primeiro adicione-a aos seus contatos
				pelo QR code ou pelo link de convite.
			</p>
			<div class="actions">
				<a href={resolve('/contatos/meu-convite')}>Convidar alguém</a>
			</div>
		{:else}
			<p class="hint count">Cabem mais {room} {room === 1 ? 'pessoa' : 'pessoas'} no grupo.</p>
			<ContactPicker {contacts} bind:chosen max={room} onchange={() => (error = '')} />
			<p class="hint">Quem entra recebe as mensagens novas, não as antigas.</p>
		{/if}

		{#if error}<p class="error" role="alert">{error}</p>{/if}
		{#if contacts?.length}
			<div class="actions">
				<button class="primary" type="submit" disabled={adding || chosen.length === 0}>
					{adding ? 'Adicionando…' : chosen.length > 1 ? `Adicionar ${chosen.length} pessoas` : 'Adicionar'}
				</button>
			</div>
		{/if}
	</form>
</main>
