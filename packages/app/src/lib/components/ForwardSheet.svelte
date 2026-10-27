<script lang="ts">
	// Escolha da conversa de destino para encaminhar uma mensagem (RF-28): toque no nome e sai.
	import { onMount } from 'svelte';
	import Avatar from './Avatar.svelte';
	import Sheet from './Sheet.svelte';
	import { session } from '#lib/session.svelte.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { onclose, onpick }: { onclose: () => void; onpick: (conversationId: string) => void } = $props();

	let targets = $state<Awaited<ReturnType<typeof session.listForwardTargets>>>();
	onMount(async () => (targets = await session.listForwardTargets()));
</script>

<Sheet label={m.encaminhar_titulo()} {onclose}>
	<p><strong>{m.encaminhar_titulo()}</strong></p>
	{#if targets && !targets.length}
		<p class="hint">{m.encaminhar_vazio()}</p>
	{/if}
	<ul class="targets">
		{#each targets ?? [] as target (target.id)}
			<li>
				<button class="item" onclick={() => onpick(target.id)}>
					<Avatar name={target.name} publicKey={target.key} group={target.group} />
					<span class="name">{target.name}</span>
				</button>
			</li>
		{/each}
	</ul>
	<button class="item cancel" onclick={onclose}>{m.comum_cancelar()}</button>
</Sheet>

<style>
	.targets {
		list-style: none;
		padding: 0;
		margin: 0;
		max-height: 50dvh;
		overflow-y: auto;
	}
	.name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
