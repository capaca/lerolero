<script lang="ts">
	// Lista de contatos para marcar quem entra num grupo (criar ou adicionar).
	import { contactName, type ContactRecord } from '@lerolero/core';
	import Avatar from './Avatar.svelte';
	import Icon from './Icon.svelte';

	let {
		contacts,
		chosen = $bindable([]),
		max,
		onchange
	}: { contacts: ContactRecord[]; chosen?: string[]; max: number; onchange?: () => void } = $props();

	function toggle(publicKey: string) {
		chosen = chosen.includes(publicKey) ? chosen.filter((k) => k !== publicKey) : [...chosen, publicKey];
		onchange?.();
	}
</script>

<ul class="list">
	{#each contacts as contact (contact.publicKey)}
		{@const selected = chosen.includes(contact.publicKey)}
		<li>
			<button
				type="button"
				class="person"
				class:selected
				aria-pressed={selected}
				disabled={!selected && chosen.length >= max}
				onclick={() => toggle(contact.publicKey)}
			>
				<Avatar name={contactName(contact)} publicKey={contact.publicKey} />
				<span class="text">{contactName(contact)}</span>
				<span class="tick" aria-hidden="true">{#if selected}<Icon name="check" size={16} />{/if}</span>
			</button>
		</li>
	{/each}
</ul>

<style>
	.list {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.person {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		width: 100%;
		padding: 0.55rem 0;
		border: none;
		border-bottom: 1px solid var(--line);
		border-radius: 0;
		background: none;
		text-align: left;
		font-weight: 400;
	}
	.text {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tick {
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		border: 2px solid var(--line);
		flex-shrink: 0;
	}
	.selected .tick {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-fg);
	}
</style>
