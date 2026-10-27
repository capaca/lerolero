<script lang="ts">
	// Menu de uma mensagem (toque longo no celular, botão direito no computador).
	import Icon from './Icon.svelte';
	import Sheet from './Sheet.svelte';
	import { m } from '#lib/paraglide/messages.js';

	let {
		mine,
		group = false,
		onclose,
		oncopy,
		ondeleteForMe,
		ondeleteForEveryone
	}: {
		mine: boolean;
		group?: boolean;
		onclose: () => void;
		/** só nas mensagens de texto */
		oncopy?: () => void;
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
		{#if oncopy}
			<button class="item" onclick={oncopy}><Icon name="copy" /> {m.menu_copiar()}</button>
		{/if}
		{#if mine}
			<button class="item" onclick={() => (confirming = true)}><Icon name="trash" /> {m.menu_apagar_todos()}</button>
		{/if}
		<button class="item" onclick={ondeleteForMe}><Icon name="trash" /> {m.menu_apagar_mim()}</button>
		<button class="item cancel" onclick={onclose}>{m.comum_cancelar()}</button>
	{/if}
</Sheet>

<style>
	.danger {
		background: var(--danger);
		border-color: var(--danger);
		color: white;
	}
</style>
