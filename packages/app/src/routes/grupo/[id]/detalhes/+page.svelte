<script lang="ts">
	// Detalhes do grupo (RF-31, RF-32): nome, membros e papéis. Abre ao tocar no nome do grupo
	// no topo da conversa. Cada ação só aparece para quem tem permissão (docs/06 §3.3).
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { canDo, groupConversationId, MAX_GROUP_MEMBERS, successor, type ConversationRecord } from '@lerolero/core';
	import Avatar from '#lib/components/Avatar.svelte';
	import BackLink from '#lib/components/BackLink.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import { friendlyError } from '#lib/errors.ts';
	import { intlLocale } from '#lib/i18n.svelte.ts';
	import { memberName } from '#lib/notices.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { session } from '#lib/session.svelte.ts';

	const groupId = $derived(page.params.id ?? '');
	const conversationId = $derived(groupConversationId(groupId));
	const me = session.identity?.publicKey ?? '';

	let conversation = $state.raw<ConversationRecord | null>();
	let nameOf = $state.raw<(publicKey: string) => string>(() => '');

	$effect(() => {
		void session.version;
		void load(conversationId);
	});

	async function load(id: string) {
		const found = (await session.getConversation(id)) ?? null;
		if (found?.group) {
			const names = await session.groupNames(found);
			nameOf = (key) => memberName(names(key));
		}
		conversation = found;
	}

	const group = $derived(conversation?.group);
	const groupState = $derived(group?.state);
	const active = $derived(!!group?.amMember);

	const roleOf = (publicKey: string) =>
		groupState?.creator === publicKey
			? m.grupo_papel_criador()
			: groupState?.admins.includes(publicKey)
				? m.grupo_papel_admin()
				: '';

	// eu primeiro, depois quem administra, depois os outros; cada parte em ordem alfabética
	const members = $derived.by(() => {
		if (!groupState) return [];
		const rank = (k: string) => (k === me ? 0 : groupState.admins.includes(k) ? 1 : 2);
		return groupState.members
			.map((m) => m.publicKey)
			.sort((a, b) => rank(a) - rank(b) || nameOf(a).localeCompare(nameOf(b), intlLocale()));
	});

	let error = $state('');
	let busy = $state(false);

	async function run(action: () => Promise<void>) {
		error = '';
		busy = true;
		try {
			await action();
		} catch (err) {
			error = friendlyError(err);
		} finally {
			busy = false;
		}
	}

	// renomear
	let editing = $state(false);
	let newName = $state('');
	function startRename() {
		newName = groupState?.name ?? '';
		editing = true;
	}
	async function rename(event: SubmitEvent) {
		event.preventDefault();
		if (newName.trim() === groupState?.name) return void (editing = false);
		await run(() => session.renameGroup(conversationId, newName));
		if (!error) editing = false;
	}

	// menu de um membro e confirmações
	let selected = $state<string>();
	let confirm = $state<'remover' | 'sair'>();
	const closeSheet = () => ((selected = undefined), (confirm = undefined));

	// pega a pessoa antes de fechar o menu: depois de fechar, `selected` já está vazio
	async function act(action: (publicKey: string) => Promise<void>) {
		const target = selected;
		closeSheet();
		if (target) await run(() => action(target));
	}

	async function leave() {
		closeSheet();
		await run(() => session.leaveGroup(conversationId));
		if (!error) await goto(resolve('/grupo/[id]', { id: groupId }));
	}

	const heir = $derived(groupState && groupState.creator === me ? successor(groupState, me) : undefined);
</script>

<svelte:head><title>{m.titulo_pagina({ pagina: groupState?.name ?? m.grupo_titulo_pagina() })}</title></svelte:head>

<main>
	<BackLink href={resolve('/grupo/[id]', { id: groupId })} label={m.conversa_titulo_pagina()} />

	{#if conversation === null}
		<p class="hint">{m.grupo_nao_esta()}</p>
	{:else if groupState}
		<div class="top">
			<Avatar name={groupState.name} publicKey={groupId} size={88} group />
			{#if editing}
				<form class="rename" onsubmit={rename}>
					<label for="nome">{m.grupo_nome_rotulo()}</label>
					<!-- svelte-ignore a11y_autofocus -->
					<input id="nome" bind:value={newName} maxlength="60" autocomplete="off" required autofocus />
					<div class="actions">
						<button type="button" onclick={() => (editing = false)}>{m.comum_cancelar()}</button>
						<button class="primary" type="submit" disabled={busy || !newName.trim()}>{m.comum_salvar()}</button>
					</div>
				</form>
			{:else}
				<h1>
					{groupState.name}
					{#if active && canDo(groupState, me, 'renomear')}
						<button class="icon" onclick={startRename} aria-label={m.grupo_mudar_nome()}><Icon name="pencil" size={18} /></button>
					{/if}
				</h1>
				<p class="hint">{m.grupo_subtitulo({ count: groupState.members.length })}</p>
			{/if}
		</div>

		{#if !active}
			<p class="banner" role="status">{m.grupo_fora()}</p>
		{/if}
		{#if error}<p class="error" role="alert">{error}</p>{/if}

		<h2>{m.grupo_participantes()}</h2>
		<ul class="list">
			{#if active && canDo(groupState, me, 'adicionar')}
				<li>
					<a class="row add" href={resolve('/grupo/[id]/adicionar', { id: groupId })}>
						<span class="circle"><Icon name="user-plus" size={20} /></span>
						<span class="text">{m.grupo_adicionar_pessoas()}</span>
					</a>
				</li>
			{:else if active && groupState.admins.includes(me)}
				<li class="hint full">{m.grupo_cheio({ max: MAX_GROUP_MEMBERS })}</li>
			{/if}
			{#each members as publicKey (publicKey)}
				<li>
					<button class="row" disabled={publicKey === me} onclick={() => (selected = publicKey)}>
						<Avatar name={nameOf(publicKey).replace(/^~/, '')} {publicKey} />
						<span class="text">{nameOf(publicKey)}</span>
						{#if roleOf(publicKey)}<span class="role">{roleOf(publicKey)}</span>{/if}
					</button>
				</li>
			{/each}
		</ul>
		{#if members.some((k) => nameOf(k).startsWith('~'))}
			<p class="hint">{m.grupo_til()}</p>
		{/if}

		{#if active}
			<button class="leave" onclick={() => (confirm = 'sair')} disabled={busy}><Icon name="log-out" /> {m.grupo_sair()}</button>
		{/if}
	{/if}
</main>

{#if groupState && confirm === 'sair'}
	<Sheet label={m.grupo_sair()} onclose={closeSheet}>
		<p><strong>{m.grupo_sair_pergunta({ grupo: groupState.name })}</strong></p>
		<p class="hint">
			{m.grupo_sair_dica()}
			{#if heir}{m.grupo_sair_herdeiro({ nome: nameOf(heir) })}{/if}
		</p>
		<div class="actions">
			<button onclick={closeSheet}>{m.comum_cancelar()}</button>
			<button class="danger" onclick={leave}>{m.grupo_sair()}</button>
		</div>
	</Sheet>
{:else if groupState && selected && confirm === 'remover'}
	{@const target = selected}
	<Sheet label={m.grupo_remover_titulo()} onclose={closeSheet}>
		<p><strong>{m.grupo_remover_pergunta({ nome: nameOf(target) })}</strong></p>
		<p class="hint">{m.grupo_remover_dica()}</p>
		<div class="actions">
			<button onclick={closeSheet}>{m.comum_cancelar()}</button>
			<button class="danger" onclick={() => act((k) => session.removeFromGroup(conversationId, k))}>{m.grupo_remover()}</button>
		</div>
	</Sheet>
{:else if groupState && selected}
	{@const target = selected}
	<Sheet label={nameOf(target)} onclose={closeSheet}>
		<p class="who"><strong>{nameOf(target)}</strong></p>
		<a class="item" href={resolve('/conversa/[chave]', { chave: target })}><Icon name="message" /> {m.contato_conversar()}</a>
		{#if active && canDo(groupState, me, 'promover', target)}
			<button class="item" onclick={() => act((k) => session.setGroupAdmin(conversationId, k, true))}>
				<Icon name="shield" /> {m.grupo_tornar_admin()}
			</button>
		{/if}
		{#if active && canDo(groupState, me, 'rebaixar', target)}
			<button class="item" onclick={() => act((k) => session.setGroupAdmin(conversationId, k, false))}>
				<Icon name="shield" /> {m.grupo_tirar_admin()}
			</button>
		{/if}
		{#if active && canDo(groupState, me, 'remover', target)}
			<button class="item remove" onclick={() => (confirm = 'remover')}><Icon name="user-minus" /> {m.grupo_remover_titulo()}</button>
		{/if}
		<button class="item cancel" onclick={closeSheet}>{m.comum_cancelar()}</button>
	</Sheet>
{/if}

<style>
	.top {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		margin-bottom: 1rem;
	}
	h1 {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		margin: 0.8rem 0 0.2rem;
		overflow-wrap: anywhere;
	}
	.top .hint {
		margin: 0;
	}
	.rename {
		width: 100%;
		text-align: left;
		margin-top: 1rem;
	}
	.icon {
		display: grid;
		place-items: center;
		padding: 0.4rem;
		border: none;
		background: none;
		color: var(--muted);
	}
	h2 {
		font-size: 1rem;
		margin: 1.5rem 0 0.3rem;
		color: var(--muted);
	}
	.list {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.row {
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
		color: var(--fg);
		text-decoration: none;
	}
	.row:disabled {
		opacity: 1;
		cursor: default;
	}
	.add {
		font-weight: 600;
		color: var(--accent);
	}
	.circle {
		display: grid;
		place-items: center;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		background: color-mix(in srgb, var(--accent) 15%, transparent);
		flex-shrink: 0;
	}
	.text {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.role {
		font-size: 0.75rem;
		color: var(--accent);
		border: 1px solid currentColor;
		border-radius: 6px;
		padding: 0.05rem 0.4rem;
		flex-shrink: 0;
	}
	.full {
		padding: 0.5rem 0;
	}
	.leave {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		width: 100%;
		margin-top: 2rem;
		border: none;
		background: none;
		padding: 0.8rem 0;
		color: var(--danger);
		font-weight: 600;
	}
	.who {
		padding: 0.3rem 0.6rem;
	}
	.remove {
		color: var(--danger) !important;
	}
	.danger {
		background: var(--danger);
		border-color: var(--danger);
		color: white;
	}
</style>
