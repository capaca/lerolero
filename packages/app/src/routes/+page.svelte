<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { contactName, toNpub, type ContactRecord, type ConversationRecord } from '@lerolero/core';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Rich from '#lib/components/Rich.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import { formatWhen } from '#lib/format.ts';
	import { previewText, type NameOf } from '#lib/notices.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { takePendingInvite } from '#lib/pending-invite.ts';
	import { phraseReminderDue, snoozePhraseReminder } from '#lib/phrase-reminder.ts';
	import { highRiskOfDataLoss, isIOS } from '#lib/platform.ts';
	import { session } from '#lib/session.svelte.ts';

	let showPhraseReminder = $state(false);
	let contactCount = $state(0);
	// undefined enquanto carrega, para não piscar a tela de "nenhuma conversa"
	// nameOf: nos grupos, para a prévia de um aviso ("Ana adicionou João") ou de uma menção ("@Ana")
	let conversations = $state.raw<Array<{ conversation: ConversationRecord; name?: string; key: string; href: string; nameOf?: NameOf }>>();
	let newChatOpen = $state(false);
	// toque longo (ou botão direito) numa conversa abre o menu de excluir
	let menuFor = $state.raw<{ conversation: ConversationRecord; name: string }>();
	let pressTimer: ReturnType<typeof setTimeout> | undefined;
	let pressStart = { x: 0, y: 0 };
	let justOpened = false;

	function openMenu(conversation: ConversationRecord, name: string) {
		clearTimeout(pressTimer);
		justOpened = true;
		menuFor = { conversation, name };
	}
	function onpointerdown(event: PointerEvent, conversation: ConversationRecord, name: string) {
		justOpened = false;
		pressStart = { x: event.clientX, y: event.clientY };
		clearTimeout(pressTimer);
		pressTimer = setTimeout(() => openMenu(conversation, name), 500);
	}
	function onpointermove(event: PointerEvent) {
		if (Math.hypot(event.clientX - pressStart.x, event.clientY - pressStart.y) > 10) clearTimeout(pressTimer);
	}
	// o toque que abriu o menu não pode também abrir a conversa
	function onclick(event: MouseEvent) {
		if (!justOpened) return;
		justOpened = false;
		event.preventDefault();
	}
	async function confirmDelete() {
		const id = menuFor?.conversation.id;
		menuFor = undefined;
		if (id) await session.deleteConversation(id);
	}

	// recarrega a lista quando chega ou sai mensagem
	$effect(() => {
		void session.version;
		void loadConversations();
	});

	// há pedidos de mensagem esperando em Contatos: só um ponto no ícone, sem número nem aviso (RF-12)
	let hasRequests = $state(false);

	async function loadConversations() {
		// "Possível spam" (sem prova de trabalho, RF-90) não acende o ponto
		hasRequests = [...(await session.listRequests()), ...(await session.listGroupRequests())].some((r) => !r.suspect);
		const list = await session.listConversations();
		const shown: ConversationRecord[] = [];
		for (const conversation of list) {
			// pedido e bloqueado não entram na lista: ficam em Contatos
			if (conversation.group?.request) continue; // pedido de grupo (ou grupo bloqueado) também fica em Contatos
			const state = conversation.group ? 'aceito' : (await session.getContact(conversation.members[0]))?.state;
			if (state !== 'pedido' && state !== 'bloqueado') shown.push(conversation);
		}
		conversations = await Promise.all(
			shown.map(async (conversation) => {
				if (conversation.group) {
					// a cor do avatar do grupo sai do id dele, como a do contato sai da chave
					const key = conversation.id.slice('grupo:'.length);
					const named = conversation.lastMessageKind === 'aviso' || conversation.lastMessagePreview?.includes('nostr:npub1');
					const nameOf = named ? await session.groupNames(conversation) : undefined;
					return { conversation, key, name: conversation.group.state.name, href: resolve('/grupo/[id]', { id: key }), nameOf };
				}
				const key = conversation.members[0];
				const contact: ContactRecord | undefined = await session.getContact(key);
				const href = resolve('/conversa/[chave]', { chave: key });
				return { conversation, key, name: contact ? contactName(contact) : undefined, href };
			})
		);
	}
	let moreOpen = $state(false);
	let showInstallWarning = $state(false);

	onMount(async () => {
		const pending = takePendingInvite();
		if (pending) return void goto(resolve('/convite') + pending);
		contactCount = (await session.listContacts()).length;
		showInstallWarning = highRiskOfDataLoss();
		showPhraseReminder = await phraseReminderDue(contactCount);
	});

	// lembrete do RF-04
	async function snooze() {
		await snoozePhraseReminder();
		showPhraseReminder = false;
	}
</script>

<svelte:head><title>{m.app_nome()}</title></svelte:head>

<main class="home">
	<header>
		<h1>{m.app_nome()}</h1>
		<nav>
			<a class="icon-button" href={hasRequests ? `${resolve('/contatos')}?aba=pedidos` : resolve('/contatos')} aria-label={hasRequests ? m.inicio_contatos_pedidos() : m.inicio_contatos()}>
				<Icon name="users" size={22} />
				{#if hasRequests}<span class="dot" aria-hidden="true"></span>{/if}
			</a>
			<button class="icon-button" aria-label={m.inicio_mais()} aria-haspopup="dialog" onclick={() => (moreOpen = true)}>
				<Icon name="more-vertical" size={22} />
			</button>
		</nav>
	</header>

	{#if showInstallWarning}
		<div class="banner" role="status">
			<p><strong>{m.inicio_instalar_titulo()}</strong></p>
			<p>
				{m.inicio_instalar_texto()}
				{#if isIOS()}<Rich text={m.inicio_instalar_ios()} />{/if}
			</p>
		</div>
	{/if}

	{#if showPhraseReminder}
		<div class="banner" role="status">
			<p><strong>{m.inicio_frase_titulo()}</strong></p>
			<p>{m.inicio_frase_texto()}</p>
			<div class="actions">
				<a href={resolve('/ajustes/protecao')}>{m.inicio_frase_guardar()}</a>
				<button class="link" onclick={snooze}>{m.inicio_frase_depois()}</button>
			</div>
		</div>
	{/if}

	{#if conversations?.length === 0}
		<section class="empty">
			<span class="empty-icon"><Icon name="message" size={40} /></span>
			{#if contactCount === 0}
				<h2>{m.inicio_vazio_convide_titulo()}</h2>
				<p class="hint">{m.inicio_vazio_convide_texto()}</p>
			{:else}
				<h2>{m.inicio_vazio_titulo()}</h2>
				<p class="hint">{m.inicio_vazio_texto()}</p>
			{/if}
			<div class="actions stack">
				{#if contactCount > 0}
					<a class="button primary" href={resolve('/contatos')}><Icon name="users" /> {m.inicio_escolher_contato()}</a>
				{/if}
				<a class="button" class:primary={contactCount === 0} href={resolve('/contatos/meu-convite')}>
					<Icon name="user-plus" /> {m.inicio_convidar()}
				</a>
				<a class="button" href={resolve('/contatos/ler')}><Icon name="scan" /> {m.inicio_ler_qr()}</a>
			</div>
		</section>
	{:else if conversations}
		<ul class="conversations">
			{#each conversations as { conversation, name, key, href, nameOf } (conversation.id)}
				<li>
					<a
						{href}
						onpointerdown={(e) => onpointerdown(e, conversation, name ?? `${toNpub(key).slice(0, 12)}…`)}
						onpointerup={() => clearTimeout(pressTimer)}
						onpointerleave={() => clearTimeout(pressTimer)}
						onpointermove={onpointermove}
						oncontextmenu={(e) => (e.preventDefault(), openMenu(conversation, name ?? `${toNpub(key).slice(0, 12)}…`))}
						{onclick}
					>
						<Avatar {name} publicKey={key} group={!!conversation.group} />
						<span class="text">
							<span class="top">
								<strong>{name ?? `${toNpub(key).slice(0, 12)}…`}</strong>
								<span class="when" class:unread={conversation.unread > 0}>{formatWhen(conversation.lastMessageAt)}</span>
							</span>
							<span class="bottom">
								<span class="preview">
									{#if conversation.lastMessageKind === 'audio'}
										<Icon name="mic" size={15} />
									{:else if conversation.lastMessageKind === 'foto'}
										<Icon name="image" size={15} />
									{:else if conversation.lastMessageKind === 'arquivo'}
										<Icon name="paperclip" size={15} />
									{/if}
									{previewText(conversation, nameOf)}
								</span>
								{#if conversation.unread > 0}
									<span class="badge" aria-label={m.inicio_nao_lidas({ count: conversation.unread })}>{conversation.unread}</span>
								{/if}
							</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}

	<button class="fab primary" aria-label={m.inicio_nova_conversa()} onclick={() => (newChatOpen = true)}>
		<Icon name="plus" size={26} />
	</button>

	{#if menuFor}
		{@const { conversation, name } = menuFor}
		<Sheet label={m.inicio_opcoes_conversa()} onclose={() => (menuFor = undefined)}>
			{#if conversation.group?.amMember}
				<p><strong>{name}</strong></p>
				<p class="hint">{m.inicio_excluir_grupo_dica()}</p>
				<button class="item cancel" onclick={() => (menuFor = undefined)}>{m.comum_entendi()}</button>
			{:else}
				<p><strong>{m.inicio_excluir_titulo({ nome: name })}</strong></p>
				<p class="hint">{conversation.group ? m.inicio_excluir_dica_grupo() : m.inicio_excluir_dica_contato()}</p>
				<div class="actions">
					<button onclick={() => (menuFor = undefined)}>{m.comum_cancelar()}</button>
					<button class="danger" onclick={confirmDelete}>{m.inicio_excluir()}</button>
				</div>
			{/if}
		</Sheet>
	{/if}

	{#if moreOpen}
		<Sheet label={m.inicio_mais()} onclose={() => (moreOpen = false)}>
			<a class="item" href={resolve('/favoritas')}><Icon name="star" /> {m.inicio_favoritas()}</a>
			<a class="item" href={resolve('/ajustes')}><Icon name="settings" /> {m.inicio_ajustes()}</a>
			<button class="item cancel" onclick={() => (moreOpen = false)}>{m.comum_cancelar()}</button>
		</Sheet>
	{/if}

	{#if newChatOpen}
		<Sheet label={m.inicio_nova_conversa()} onclose={() => (newChatOpen = false)}>
			<a class="item" href={resolve('/contatos')}><Icon name="message" /> {m.inicio_novo_contato()}</a>
			<a class="item" href={resolve('/grupo/novo')}><Icon name="users" /> {m.inicio_novo_grupo()}</a>
			<a class="item" href={resolve('/contatos/ler')}><Icon name="scan" /> {m.inicio_novo_ler_qr()}</a>
			<a class="item" href={resolve('/contatos/meu-convite')}><Icon name="user-plus" /> {m.inicio_convidar()}</a>
			<button class="item cancel" onclick={() => (newChatOpen = false)}>{m.comum_cancelar()}</button>
		</Sheet>
	{/if}
</main>

<style>
	.danger {
		background: var(--danger);
		border-color: var(--danger);
		color: white;
	}
	.home {
		/* espaço para o botão flutuante não cobrir a última conversa */
		padding-bottom: 6rem;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	header h1 {
		margin: 0.3rem 0;
	}
	nav {
		display: flex;
		gap: 0.2rem;
	}
	.icon-button {
		border: 0;
		background: none;
		padding: 0;
		cursor: pointer;
		position: relative;
		display: grid;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		border-radius: 50%;
		color: var(--fg);
	}
	.dot {
		position: absolute;
		top: 0.55rem;
		right: 0.55rem;
		width: 0.65rem;
		height: 0.65rem;
		border-radius: 50%;
		background: var(--danger);
		border: 2px solid var(--bg, white);
	}
	.icon-button:hover {
		background: var(--line);
	}
	.conversations {
		list-style: none;
		margin: 0.5rem -16px 0;
		padding: 0;
	}
	.conversations a {
		-webkit-touch-callout: none;
		user-select: none;
		display: flex;
		align-items: center;
		gap: 0.8rem;
		padding: 0 16px;
		color: var(--fg);
		text-decoration: none;
	}
	.conversations a:hover {
		background: var(--surface);
	}
	.text {
		flex: 1;
		min-width: 0;
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--line);
	}
	.conversations li:last-child .text {
		border-bottom: none;
	}
	.top strong {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.top,
	.bottom {
		display: flex;
		justify-content: space-between;
		gap: 0.8rem;
	}
	.when {
		font-size: 0.8rem;
		color: var(--muted);
		flex-shrink: 0;
	}
	.when.unread {
		color: var(--accent);
		font-weight: 600;
	}
	.preview {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		min-width: 0;
		color: var(--muted);
		font-size: 0.92rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.badge {
		background: var(--accent);
		color: var(--accent-fg);
		border-radius: 999px;
		min-width: 1.4rem;
		padding: 0 0.4rem;
		font-size: 0.78rem;
		font-weight: 700;
		text-align: center;
		flex-shrink: 0;
	}
	.empty {
		text-align: center;
		margin: 3rem auto 0;
		max-width: 22rem;
	}
	.empty h2 {
		margin: 1rem 0 0.4rem;
	}
	.empty-icon {
		display: inline-grid;
		place-items: center;
		width: 5.5rem;
		height: 5.5rem;
		border-radius: 50%;
		background: color-mix(in srgb, var(--accent) 15%, var(--surface));
		color: var(--accent);
	}
	.button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		text-decoration: none;
		font-weight: 600;
		padding: 0.75rem 1rem;
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
	.fab {
		position: fixed;
		/* acompanha a coluna central de 560px em telas largas */
		right: max(16px, calc((100vw - 560px) / 2 + 16px));
		bottom: calc(16px + env(safe-area-inset-bottom));
		width: 3.5rem;
		height: 3.5rem;
		padding: 0;
		border-radius: 50%;
		display: grid;
		place-items: center;
		box-shadow: 0 4px 14px rgb(0 0 0 / 0.25);
		z-index: 5;
	}
</style>
