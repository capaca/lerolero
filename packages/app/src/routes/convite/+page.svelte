<script lang="ts">
	import BackLink from '#lib/components/BackLink.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { contactName, parseInvite, toNpub, type ContactRecord, type Invite } from '@lerolero/core';
	import { onMount } from 'svelte';
	import { friendlyError } from '#lib/errors.ts';
	import { phraseOfferDue } from '#lib/phrase-reminder.ts';
	import { session } from '#lib/session.svelte.ts';

	let invite = $state.raw<Invite>();
	let existing = $state.raw<ContactRecord>();
	let localName = $state('');
	let error = $state('');
	let busy = $state(false);

	onMount(async () => {
		try {
			const parsed = parseInvite(location.hash);
			if (parsed.publicKey === session.identity?.publicKey) {
				error = 'Este é o seu próprio convite. Mande-o para quem você quer adicionar.';
				return;
			}
			invite = parsed;
			// quem só escreveu sem ser contato ("pedido") ainda não está nos contatos
			const known = await session.getContact(parsed.publicKey);
			existing = known?.state === 'aceito' ? known : undefined;
			localName = existing?.localName ?? invite.name ?? '';
		} catch (err) {
			invite = undefined;
			error = friendlyError(err);
		}
	});

	async function add(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		try {
			const contact = await session.addContact(invite!, localName);
			// o primeiro contato é a hora de guardar a frase (Q-U1)
			const next = (await phraseOfferDue())
				? resolve('/guardar-frase') + '?contato=' + contact.publicKey
				: resolve('/contatos/[chave]', { chave: contact.publicKey });
			await goto(next, { replaceState: true });
		} catch (err) {
			error = friendlyError(err);
			busy = false;
		}
	}
</script>

<svelte:head><title>Convite · Lero-lero</title></svelte:head>

<main>
	<BackLink href={resolve('/contatos')} label="Contatos" />
	{#if error}
		<h1>Convite</h1>
		<p class="error" role="alert">{error}</p>
	{:else if invite}
		<h1>{existing ? 'Atualizar contato' : 'Adicionar contato'}</h1>
		{#if existing}
			<p>Esta pessoa já está nos seus contatos como <strong>{contactName(existing)}</strong>.</p>
		{/if}
		<div class="card">
			<p>
				Se apresenta como: <strong>{invite.name ?? '(sem nome)'}</strong>
			</p>
			<p class="hint key">{toNpub(invite.publicKey)}</p>
		</div>
		<form onsubmit={add}>
			<label for="nome">Como quer salvar esta pessoa?</label>
			<input id="nome" maxlength="40" autocomplete="off" bind:value={localName} />
			<p class="hint">
				Este nome só você vê, e é ele que aparece nas conversas. Se recebeu o link de alguém que diz ser um
				conhecido, confirme por ligação ou pessoalmente antes de confiar: golpistas usam nomes de parentes.
			</p>
			<div class="actions">
				<button class="primary" type="submit" disabled={busy}>{existing ? 'Salvar' : 'Adicionar'}</button>
			</div>
		</form>
	{:else}
		<p class="hint">Lendo o convite…</p>
	{/if}
</main>

<style>
	.key {
		font-family: ui-monospace, monospace;
		font-size: 0.8rem;
		overflow-wrap: anywhere;
	}
</style>
