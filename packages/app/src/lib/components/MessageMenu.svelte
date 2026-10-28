<script lang="ts">
	// Menu de uma mensagem (toque longo no celular, botão direito no computador).
	import Icon from './Icon.svelte';
	import Sheet from './Sheet.svelte';
	import { QUICK_REACTIONS } from '@lerolero/core';
	import { m } from '#lib/paraglide/messages.js';

	let {
		mine,
		group = false,
		onclose,
		myReaction,
		onreact,
		onreply,
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
			<div class="reactions" role="group" aria-label={m.menu_reacoes()}>
				{#each QUICK_REACTIONS as emoji (emoji)}
					<button type="button" class="emoji" class:chosen={myReaction === emoji} aria-pressed={myReaction === emoji} aria-label={m.menu_reagir({ emoji })} onclick={() => onreact(emoji)}>
						{emoji}
					</button>
				{/each}
			</div>
		{/if}
		{#if onreply}
			<button class="item" onclick={onreply}><Icon name="reply" /> {m.menu_responder()}</button>
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
	.emoji {
		flex: 1;
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
		color: white;
	}
</style>
