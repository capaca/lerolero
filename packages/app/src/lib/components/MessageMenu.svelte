<script lang="ts">
	// Menu de uma mensagem (toque longo no celular, botão direito no computador).
	import Icon from './Icon.svelte';
	import Sheet from './Sheet.svelte';

	let {
		mine,
		onclose,
		ondeleteForMe,
		ondeleteForEveryone
	}: { mine: boolean; onclose: () => void; ondeleteForMe: () => void; ondeleteForEveryone: () => void } = $props();

	let confirming = $state(false);
</script>

<Sheet label="Opções da mensagem" {onclose}>
	{#if confirming}
		<p><strong>Apagar para todos?</strong></p>
		<p class="hint">
			A mensagem some para você e, no Lero-lero, para o contato também. Se ele usar outro app compatível, o app
			dele pode ignorar o pedido.
		</p>
		<div class="actions">
			<button onclick={onclose}>Cancelar</button>
			<button class="danger" onclick={ondeleteForEveryone}>Apagar para todos</button>
		</div>
	{:else}
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
