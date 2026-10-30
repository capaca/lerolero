<script lang="ts">
	// Menu de uma mensagem (toque longo no celular, botão direito no computador).
	import Icon from './Icon.svelte';
	import Sheet from './Sheet.svelte';
	import { QUICK_REACTIONS, REACTION_PICKER } from '@lerolero/core';
	import { m } from '#lib/paraglide/messages.js';

	let {
		mine,
		group = false,
		onclose,
		myReaction,
		onreact,
		onreply,
		onedit,
		starred = false,
		onstar,
		onselect,
		oncopy,
		onforward,
		ondeleteForMe,
		ondeleteForEveryone
	}: {
		mine: boolean;
		group?: boolean;
		onclose: () => void;
		/** o emoji que eu já dei a esta mensagem; tocar nele de novo desfaz */
		myReaction?: string;
		/** só no que já saiu e não foi apagado */
		onreact?: (emoji: string) => void;
		onreply?: () => void;
		/** só nas minhas de texto, até 15 minutos depois (RF-24) */
		onedit?: () => void;
		/** favorita agora; `onstar` alterna (RF-28) */
		starred?: boolean;
		onstar?: () => void;
		onselect?: () => void;
		/** só nas mensagens de texto */
		oncopy?: () => void;
		/** só no que já saiu e não foi apagado */
		onforward?: () => void;
		ondeleteForMe: () => void;
		ondeleteForEveryone: () => void;
	} = $props();

	let confirming = $state(false);
	// "+" abre o seletor completo no lugar dos seis principais
	let picking = $state(false);
</script>

<Sheet label={m.menu_opcoes()} {onclose}>
	{#if confirming}
		<p><strong>{m.menu_apagar_todos_pergunta()}</strong></p>
		<p class="hint">{group ? m.menu_apagar_todos_dica_grupo() : m.menu_apagar_todos_dica_contato()}</p>
		<div class="actions">
			<button onclick={onclose}>{m.comum_cancelar()}</button>
			<button class="danger" onclick={ondeleteForEveryone}>{m.menu_apagar_todos()}</button>
		</div>
	{:else}
		{#if onreact}
			<div class="reactions" class:all={picking} role="group" aria-label={m.menu_reacoes()}>
				{#each picking ? REACTION_PICKER : QUICK_REACTIONS as emoji (emoji)}
					<button type="button" class="emoji" class:chosen={myReaction === emoji} aria-pressed={myReaction === emoji} aria-label={m.menu_reagir({ emoji })} onclick={() => onreact(emoji)}>
						{emoji}
					</button>
				{/each}
				<button type="button" class="emoji more" aria-expanded={picking} aria-label={picking ? m.menu_menos_reacoes() : m.menu_mais_reacoes()} onclick={() => (picking = !picking)}>
					<Icon name={picking ? 'chevron-down' : 'plus'} size={22} />
				</button>
			</div>
		{/if}
		{#if onreply}
			<button class="item" onclick={onreply}><Icon name="reply" /> {m.menu_responder()}</button>
		{/if}
		{#if onedit}
			<button class="item" onclick={onedit}><Icon name="pencil" /> {m.menu_editar()}</button>
		{/if}
		{#if onstar}
			<button class="item" onclick={onstar}><Icon name="star" /> {starred ? m.menu_desfavoritar() : m.menu_favoritar()}</button>
		{/if}
		{#if oncopy}
			<button class="item" onclick={oncopy}><Icon name="copy" /> {m.menu_copiar()}</button>
		{/if}
		{#if onforward}
			<button class="item" onclick={onforward}><Icon name="forward" /> {m.menu_encaminhar()}</button>
		{/if}
		{#if onselect}
			<button class="item" onclick={onselect}><Icon name="check" /> {m.menu_selecionar()}</button>
		{/if}
		{#if mine}
			<button class="item" onclick={() => (confirming = true)}><Icon name="trash" /> {m.menu_apagar_todos()}</button>
		{/if}
		<button class="item" onclick={ondeleteForMe}><Icon name="trash" /> {m.menu_apagar_mim()}</button>
		<button class="item cancel" onclick={onclose}>{m.comum_cancelar()}</button>
	{/if}
</Sheet>

<style>
	.reactions {
		display: flex;
		justify-content: space-between;
		gap: 0.2rem;
		margin-bottom: 0.4rem;
	}
	/* o seletor completo: oito por fileira, rolando se faltar altura */
	.reactions.all {
		display: grid;
		grid-template-columns: repeat(8, minmax(0, 1fr));
		max-height: 40vh;
		overflow-y: auto;
	}
	.emoji.more {
		display: grid;
		place-items: center;
		color: var(--muted);
	}
	.emoji {
		flex: 1;
		min-width: 0;
		padding: 0;
		min-height: 3rem;
		font-size: 1.6rem;
		line-height: 1;
		border-radius: 999px;
		border: 1px solid transparent;
		background: transparent;
	}
	.emoji.chosen {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 15%, var(--surface));
	}
	.danger {
		background: var(--danger);
		border-color: var(--danger);
		color: var(--danger-fg);
	}
</style>
