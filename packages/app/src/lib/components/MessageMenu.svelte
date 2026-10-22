<script lang="ts">
	// Menu de uma mensagem (toque longo no celular, botão direito no computador).
	import Icon from './Icon.svelte';
	import Sheet from './Sheet.svelte';

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

<Sheet label="Opções da mensagem" {onclose}>
	{#if confirming}
		<p><strong>Apagar para todos?</strong></p>
		<p class="hint">
			{#if group}
				A mensagem some para você e, no Lero-lero, para todos do grupo. Quem usar outro app compatível pode
				continuar vendo.
			{:else}
				A mensagem some para você e, no Lero-lero, para o contato também. Se ele usar outro app compatível, o app
				dele pode ignorar o pedido.
			{/if}
		</p>
		<div class="actions">
			<button onclick={onclose}>Cancelar</button>
			<button class="danger" onclick={ondeleteForEveryone}>Apagar para todos</button>
		</div>
	{:else}
		{#if oncopy}
			<button class="item" onclick={oncopy}><Icon name="copy" /> Copiar</button>
		{/if}
		{#if mine}
			<button class="item" onclick={() => (confirming = true)}><Icon name="trash" /> Apagar para todos</button>
		{/if}
		<button class="item" onclick={ondeleteForMe}><Icon name="trash" /> Apagar para mim</button>
		<button class="item cancel" onclick={onclose}>Cancelar</button>
	{/if}
</Sheet>

<style>
	.danger {
		background: var(--danger);
		border-color: var(--danger);
		color: white;
	}
</style>
