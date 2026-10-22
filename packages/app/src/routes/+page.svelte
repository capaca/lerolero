<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { contactName, toNpub, type ContactRecord, type ConversationRecord } from '@lerolero/core';
	import { formatWhen } from '#lib/format.ts';
	import { takePendingInvite } from '#lib/pending-invite.ts';
	import { highRiskOfDataLoss, isIOS } from '#lib/platform.ts';
	import { session } from '#lib/session.svelte.ts';

	const DAY = 24 * 60 * 60 * 1000;
	const SNOOZE_KEY = 'lembreteFraseAdiadoAte';

	let showPhraseReminder = $state(false);
	let contactCount = $state(0);
	let conversations = $state.raw<Array<{ conversation: ConversationRecord; name: string; key: string }>>([]);

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
				return { conversation, key, name: contact ? contactName(contact) : `${toNpub(key).slice(0, 12)}…` };
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

<main>
	<header>
		<h1>Olá, {session.identity?.displayName}</h1>
		<a href={resolve('/ajustes')}>Ajustes</a>
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

	<section class="card">
		<h2>Conversas</h2>
		{#if conversations.length === 0}
			<p class="hint">Nenhuma conversa ainda. Abra um contato e toque em <strong>Conversar</strong>.</p>
		{:else}
			<ul class="conversations">
				{#each conversations as { conversation, name, key } (conversation.id)}
					<li>
						<a href={resolve('/conversa/[chave]', { chave: key })}>
							<span class="top">
								<strong>{name}</strong>
								<span class="when" class:unread={conversation.unread > 0}>{formatWhen(conversation.lastMessageAt)}</span>
							</span>
							<span class="bottom">
								<span class="preview">{conversation.lastMessagePreview ?? ''}</span>
								{#if conversation.unread > 0}
									<span class="badge" aria-label={`${conversation.unread} não lidas`}>{conversation.unread}</span>
								{/if}
							</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="card">
		<h2>Contatos</h2>
		<p>
			{contactCount === 0
				? 'Você ainda não tem contatos.'
				: contactCount === 1
					? '1 contato.'
					: `${contactCount} contatos.`}
		</p>
		<div class="actions">
			<a href={resolve('/contatos')}>Ver contatos</a>
			<a href={resolve('/contatos/meu-convite')}>Convidar alguém</a>
		</div>
	</section>

</main>

<style>
	.conversations {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.conversations a {
		display: block;
		padding: 0.7rem 0;
		border-bottom: 1px solid var(--line);
		color: var(--fg);
		text-decoration: none;
	}
	.conversations li:last-child a {
		border-bottom: none;
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
	header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}
</style>
