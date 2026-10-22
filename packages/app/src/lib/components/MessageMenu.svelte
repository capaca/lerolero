<script lang="ts">
	// Menu de uma mensagem (toque longo no celular, botão direito no computador).
	import Icon from './Icon.svelte';

	let {
		mine,
		onclose,
		ondeleteForMe,
		ondeleteForEveryone
	}: { mine: boolean; onclose: () => void; ondeleteForMe: () => void; ondeleteForEveryone: () => void } = $props();

	let confirming = $state(false);
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" onclick={onclose}></div>
<div class="sheet" role="dialog" aria-modal="true" aria-label="Opções da mensagem">
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
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgb(0 0 0 / 0.35);
		z-index: 20;
	}
	.sheet {
		position: fixed;
		left: 50%;
		bottom: 0;
		transform: translateX(-50%);
		width: min(100%, 520px);
		z-index: 21;
		background: var(--surface);
		border-radius: 16px 16px 0 0;
		padding: 0.6rem 1rem calc(1rem + env(safe-area-inset-bottom));
		box-shadow: 0 -4px 24px rgb(0 0 0 / 0.2);
	}
	.item {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		width: 100%;
		border: none;
		background: none;
		border-radius: 10px;
		padding: 0.9rem 0.6rem;
		text-align: left;
		font-weight: 500;
	}
	.item:hover {
		background: var(--bg);
	}
	.cancel {
		justify-content: center;
		color: var(--muted);
	}
	.danger {
		background: var(--danger);
		border-color: var(--danger);
		color: white;
	}
	p {
		margin: 0.4rem 0;
	}
</style>
