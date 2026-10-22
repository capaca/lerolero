<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { contactName, directConversationId, MAX_TEXT_LENGTH, toNpub, type ContactRecord, type MessageRecord } from '@lerolero/core';
	import { onDestroy, tick } from 'svelte';
	import { dayKey, formatDay, formatTime } from '#lib/format.ts';
	import { friendlyError, session } from '#lib/session.svelte.ts';

	// Abre com as últimas mensagens; as anteriores vêm sob demanda. As mensagens ficam
	// em blocos com content-visibility: o modo que rolou melhor no celular (prototipos/medicao).
	const PAGE_SIZE = 200;
	const BLOCK_SIZE = 50;

	const publicKey = $derived(page.params.chave ?? '');
	const me = session.identity?.publicKey;

	let contact = $state.raw<ContactRecord | null>();
	let messages = $state.raw<MessageRecord[]>([]);
	let hasOlder = $state(false);
	let extraPages = 0;
	let firstLoad = true;
	let text = $state('');
	let error = $state('');
	let scroller = $state<HTMLDivElement>();
	let input = $state<HTMLTextAreaElement>();

	type Item = { type: 'dia'; key: number; label: string } | { type: 'msg'; message: MessageRecord };
	const blocks = $derived.by(() => {
		const items: Item[] = [];
		let lastDay: number | undefined;
		for (const message of messages) {
			const day = dayKey(message.createdAt);
			if (day !== lastDay) items.push({ type: 'dia', key: day, label: formatDay(message.createdAt) });
			lastDay = day;
			items.push({ type: 'msg', message });
		}
		const out: Item[][] = [];
		for (let i = 0; i < items.length; i += BLOCK_SIZE) out.push(items.slice(i, i + BLOCK_SIZE));
		return out;
	});

	const nearBottom = () => !scroller || scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 150;

	async function load() {
		const limit = PAGE_SIZE * (1 + extraPages);
		const list = await session.getMessages(publicKey, limit + 1);
		const stick = firstLoad || nearBottom() || list.at(-1)?.sender === me;
		hasOlder = list.length > limit;
		messages = hasOlder ? list.slice(1) : list;
		contact = (await session.getContact(publicKey)) ?? null;
		await tick();
		if (stick && scroller) scroller.scrollTop = scroller.scrollHeight;
		firstLoad = false;
		if ((await session.getConversation(publicKey))?.unread) await session.markRead(publicKey);
	}

	// recarrega quando muda a conversa ou chega/sai qualquer mensagem (session.version)
	$effect(() => {
		void session.version;
		session.openConversationId = directConversationId(publicKey);
		void load();
	});
	onDestroy(() => (session.openConversationId = undefined));

	async function loadOlder() {
		const before = scroller!.scrollHeight;
		extraPages++;
		await load();
		// mantém na tela a mensagem que a pessoa estava lendo
		scroller!.scrollTop += scroller!.scrollHeight - before;
	}

	async function send(event?: SubmitEvent) {
		event?.preventDefault();
		const message = text.trim();
		if (!message) return;
		error = '';
		text = '';
		try {
			await session.sendText(publicKey, message);
		} catch (err) {
			text = message;
			error = friendlyError(err);
		}
		input?.focus();
	}

	// no computador, Enter envia e Shift+Enter quebra a linha; no celular, Enter quebra a linha
	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey && matchMedia('(pointer: fine)').matches) {
			event.preventDefault();
			void send();
		}
	}

	const name = $derived(contact ? contactName(contact) : contact === null ? `${toNpub(publicKey).slice(0, 12)}…` : '');
	const isContact = $derived(contact?.state === 'aceito');
	const inviteHash = $derived(`#${toNpub(publicKey)}${contact?.chosenName ? `&n=${encodeURIComponent(contact.chosenName)}` : ''}`);
</script>

<svelte:head><title>{name || 'Conversa'} · Lero-lero</title></svelte:head>

<div class="chat">
	<header>
		<a href={resolve('/')} aria-label="Voltar para as conversas">←</a>
		{#if isContact}
			<a class="name" href={resolve('/contatos/[chave]', { chave: publicKey })}>{name}</a>
		{:else}
			<span class="name">{name}</span>
		{/if}
	</header>

	{#if contact !== undefined && !isContact}
		<div class="banner notice">
			<p>
				<strong>Esta pessoa não está nos seus contatos.</strong>
				{#if contact?.chosenName}Ela se apresenta como “{contact.chosenName}”, mas qualquer um pode escolher qualquer nome.{/if}
			</p>
			<a href={resolve('/convite') + inviteHash}>Adicionar aos contatos</a>
		</div>
	{/if}

	<div class="messages" bind:this={scroller} aria-live="polite">
		{#if hasOlder}
			<button class="link older" onclick={loadOlder}>Carregar mensagens anteriores</button>
		{/if}
		{#if messages.length === 0 && contact !== undefined}
			<p class="hint empty">Nenhuma mensagem ainda. Diga oi!</p>
		{/if}
		{#each blocks as block, b (b)}
			<div class="block" style:--block-estimate="{block.length * 56}px">
				{#each block as item (item.type === 'dia' ? `d${item.key}` : item.message.id)}
					{#if item.type === 'dia'}
						<p class="day">{item.label}</p>
					{:else}
						{@const m = item.message}
						<div class="row" class:mine={m.sender === me}>
							<div class="bubble">
								<p>{m.text}</p>
								<span class="meta">
									{formatTime(m.createdAt)}
									{#if m.sender === me}
										<span class="status" title={m.status === 'pendente' ? 'Enviando' : 'Enviada'}>
											{m.status === 'pendente' ? '🕓' : '✓'}
										</span>
									{/if}
								</span>
							</div>
						</div>
					{/if}
				{/each}
			</div>
		{/each}
	</div>

	<form class="composer" onsubmit={send}>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<div class="line">
			<textarea
				bind:this={input}
				bind:value={text}
				{onkeydown}
				rows="1"
				maxlength={MAX_TEXT_LENGTH}
				placeholder="Mensagem"
				aria-label="Mensagem"
			></textarea>
			<button class="primary" type="submit" disabled={!text.trim()} aria-label="Enviar">Enviar</button>
		</div>
	</form>
</div>

<style>
	.chat {
		height: 100dvh;
		display: flex;
		flex-direction: column;
		max-width: 720px;
		margin: 0 auto;
	}
	header {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		padding: 0.7rem 1rem;
		border-bottom: 1px solid var(--line);
		background: var(--surface);
	}
	header a {
		text-decoration: none;
		font-size: 1.2rem;
	}
	.name {
		font-weight: 700;
		font-size: 1.05rem;
		color: var(--fg);
	}
	.notice {
		margin: 0.6rem 1rem 0;
	}
	.messages {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem 0.8rem;
		overflow-anchor: none;
	}
	.block {
		content-visibility: auto;
		contain-intrinsic-size: auto var(--block-estimate);
	}
	.older {
		display: block;
		margin: 0.5rem auto;
	}
	.empty {
		text-align: center;
		margin-top: 2rem;
	}
	.day {
		text-align: center;
		color: var(--muted);
		font-size: 0.8rem;
		margin: 0.9rem 0 0.4rem;
	}
	.row {
		display: flex;
		margin: 2px 0;
	}
	.row.mine {
		justify-content: flex-end;
	}
	.bubble {
		max-width: 80%;
		padding: 0.4rem 0.7rem 0.3rem;
		border-radius: 12px;
		background: var(--surface);
		border: 1px solid var(--line);
	}
	.mine .bubble {
		background: color-mix(in srgb, var(--accent) 18%, var(--surface));
		border-color: transparent;
	}
	.bubble p {
		margin: 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.meta {
		display: block;
		text-align: right;
		font-size: 0.7rem;
		color: var(--muted);
	}
	.composer {
		padding: 0.6rem 0.8rem calc(0.6rem + env(safe-area-inset-bottom));
		border-top: 1px solid var(--line);
		background: var(--surface);
	}
	.composer .error {
		margin: 0 0 0.4rem;
	}
	.line {
		display: flex;
		gap: 0.5rem;
		align-items: flex-end;
	}
	textarea {
		flex: 1;
		resize: none;
		max-height: 8rem;
		field-sizing: content;
	}
</style>
