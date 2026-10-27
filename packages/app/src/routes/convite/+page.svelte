<script lang="ts">
	import BackLink from '#lib/components/BackLink.svelte';
	import Rich from '#lib/components/Rich.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { contactName, parseInvite, toNpub, type ContactRecord, type Invite } from '@lerolero/core';
	import { onMount } from 'svelte';
	import { friendlyError } from '#lib/errors.ts';
	import { m } from '#lib/paraglide/messages.js';
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
				error = m.convite_proprio();
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

<svelte:head><title>{m.titulo_pagina({ pagina: m.convite_titulo() })}</title></svelte:head>

<main>
	<BackLink href={resolve('/contatos')} label={m.contatos_titulo()} />
	{#if error}
		<h1>{m.convite_titulo()}</h1>
		<p class="error" role="alert">{error}</p>
	{:else if invite}
		<h1>{existing ? m.convite_atualizar() : m.contatos_adicionar()}</h1>
		{#if existing}
			<p><Rich text={m.convite_ja_contato({ nome: contactName(existing) })} /></p>
		{/if}
		<div class="card">
			<p><Rich text={m.convite_se_apresenta({ nome: invite.name ?? m.convite_sem_nome() })} /></p>
			<p class="hint key">{toNpub(invite.publicKey)}</p>
		</div>
		<form onsubmit={add}>
			<label for="nome">{m.convite_nome_rotulo()}</label>
			<input id="nome" maxlength="40" autocomplete="off" bind:value={localName} />
			<p class="hint">{m.convite_nome_dica()}</p>
			<div class="actions">
				<button class="primary" type="submit" disabled={busy}>{existing ? m.comum_salvar() : m.convite_adicionar()}</button>
			</div>
		</form>
	{:else}
		<p class="hint">{m.convite_lendo()}</p>
	{/if}
</main>

<style>
	.key {
		font-family: ui-monospace, monospace;
		font-size: 0.8rem;
		overflow-wrap: anywhere;
	}
</style>
