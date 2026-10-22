<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { contactName, toNpub, type ContactRecord, type ConversationRecord } from '@lerolero/core';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import { formatWhen } from '#lib/format.ts';
	import { takePendingInvite } from '#lib/pending-invite.ts';
	import { highRiskOfDataLoss, isIOS } from '#lib/platform.ts';
	import { session } from '#lib/session.svelte.ts';

	const DAY = 24 * 60 * 60 * 1000;
	const SNOOZE_KEY = 'lembreteFraseAdiadoAte';

	let showPhraseReminder = $state(false);
	let contactCount = $state(0);
	// undefined enquanto carrega, para não piscar a tela de "nenhuma conversa"
	let conversations = $state.raw<Array<{ conversation: ConversationRecord; name?: string; key: string }>>();
	let newChatOpen = $state(false);

	// recarrega a lista quando chega ou sai mensagem
	$effect(() => {
		void session.version;
		void loadConversations();
	});

	async function loadConversations() {
		const list = await session.listConversations();
		conversations = await Promise.all(
			list.map(async (conversation) => {
				const key = conversation.members[0];
				const contact: ContactRecord | undefined = await session.getContact(key);
				return { conversation, key, name: contact ? contactName(contact) : undefined };
			})
		);
	}
	let showInstallWarning = $state(false);
	let highRisk = false;

	onMount(async () => {
		const pending = takePendingInvite();
		if (pending) return void goto(resolve('/convite') + pending);
		contactCount = (await session.listContacts()).length;
		highRisk = highRiskOfDataLoss();
		showInstallWarning = highRisk;
		const snoozedUntil = (await session.getSetting<number>(SNOOZE_KEY)) ?? 0;
		showPhraseReminder = !session.identity?.phraseConfirmed && Date.now() > snoozedUntil;
	});

	// lembrete do RF-04: volta em 3 dias, ou em 1 se o risco de perder os dados for maior
	async function snooze() {
		await session.setSetting(SNOOZE_KEY, Date.now() + (highRisk ? 1 : 3) * DAY);
		showPhraseReminder = false;
	}
</script>

<svelte:head><title>Lero-lero</title></svelte:head>

<main class="home">
	<header>
		<h1>Lero-lero</h1>
		<nav>
			<a class="icon-button" href={resolve('/contatos')} aria-label="Contatos"><Icon name="users" size={22} /></a>
			<a class="icon-button" href={resolve('/ajustes')} aria-label="Ajustes"><Icon name="settings" size={22} /></a>
		</nav>
	</header>

	{#if showInstallWarning}
		<div class="banner" role="status">
			<p><strong>Instale o Lero-lero na tela de início.</strong></p>
			<p>
				No iPhone, o Safari pode apagar os dados de sites que ficam alguns dias sem uso. Instalado, o app fica
				protegido. {#if isIOS()}Toque em <strong>Compartilhar</strong> e depois em
					<strong>Adicionar à Tela de Início</strong>.{/if}
			</p>
		</div>
	{/if}

	{#if showPhraseReminder}
		<div class="banner" role="status">
			<p><strong>Você ainda não conferiu sua frase de recuperação.</strong></p>
			<p>Sem ela, perder o celular ou esquecer o PIN significa perder sua conta.</p>
			<div class="actions">
				<a href={resolve('/ajustes/frase')}>Conferir agora</a>
				<button class="link" onclick={snooze}>Lembrar depois</button>
			</div>
		</div>
	{/if}

	{#if conversations?.length === 0}
		<section class="empty">
			<span class="empty-icon"><Icon name="message" size={40} /></span>
			{#if contactCount === 0}
				<h2>Comece convidando alguém</h2>
				<p class="hint">Mostre seu QR code ou mande seu link de convite. Ou leia o QR code de quem te convidou.</p>
			{:else}
				<h2>Nenhuma conversa ainda</h2>
				<p class="hint">Escolha um contato para começar, ou chame mais alguém para o Lero-lero.</p>
			{/if}
			<div class="actions stack">
				{#if contactCount > 0}
					<a class="button primary" href={resolve('/contatos')}><Icon name="users" /> Escolher um contato</a>
				{/if}
				<a class="button" class:primary={contactCount === 0} href={resolve('/contatos/meu-convite')}>
					<Icon name="user-plus" /> Convidar alguém
				</a>
				<a class="button" href={resolve('/contatos/ler')}><Icon name="scan" /> Ler QR code</a>
			</div>
		</section>
	{:else if conversations}
		<ul class="conversations">
			{#each conversations as { conversation, name, key } (conversation.id)}
				<li>
					<a href={resolve('/conversa/[chave]', { chave: key })}>
						<Avatar {name} publicKey={key} />
						<span class="text">
							<span class="top">
								<strong>{name ?? `${toNpub(key).slice(0, 12)}…`}</strong>
								<span class="when" class:unread={conversation.unread > 0}>{formatWhen(conversation.lastMessageAt)}</span>
							</span>
							<span class="bottom">
								<span class="preview">
									{#if conversation.lastMessageKind === 'audio' || conversation.lastMessagePreview?.startsWith('🎤')}
										<Icon name="mic" size={15} /> Áudio
									{:else if conversation.lastMessageKind === 'arquivo' || conversation.lastMessagePreview?.startsWith('📎')}
										<Icon name="paperclip" size={15} /> Arquivo
									{:else}
										{conversation.lastMessagePreview ?? ''}
									{/if}
								</span>
								{#if conversation.unread > 0}
									<span class="badge" aria-label={`${conversation.unread} não lidas`}>{conversation.unread}</span>
								{/if}
							</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}

	<button class="fab primary" aria-label="Nova conversa" onclick={() => (newChatOpen = true)}>
		<Icon name="plus" size={26} />
	</button>

	{#if newChatOpen}
		<Sheet label="Nova conversa" onclose={() => (newChatOpen = false)}>
			<a class="item" href={resolve('/contatos')}><Icon name="users" /> Conversar com um contato</a>
			<a class="item" href={resolve('/contatos/ler')}><Icon name="scan" /> Adicionar contato (ler QR code)</a>
			<a class="item" href={resolve('/contatos/meu-convite')}><Icon name="user-plus" /> Convidar alguém</a>
			<button class="item cancel" onclick={() => (newChatOpen = false)}>Cancelar</button>
		</Sheet>
	{/if}
</main>

<style>
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
		display: grid;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		border-radius: 50%;
		color: var(--fg);
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
