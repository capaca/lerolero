<script lang="ts">
	// A bolinha mostra como os contatos vão ver; tocar nela escolhe a foto (item 26). Usada no cadastro e no perfil.
	import Avatar from './Avatar.svelte';
	import Icon from './Icon.svelte';
	import { m } from '#lib/paraglide/messages.js';

	let {
		name,
		publicKey,
		preview,
		hasPhoto,
		showPhoto = true,
		size = 96,
		testid,
		onpick
	}: {
		name: string;
		publicKey: string;
		/** foto escolhida e ainda não salva */
		preview?: string;
		hasPhoto: boolean;
		showPhoto?: boolean;
		size?: number;
		testid: string;
		onpick: (file: File) => void;
	} = $props();

	let picker: HTMLInputElement;

	function pick(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (file) onpick(file);
	}
</script>

<button class="photo" type="button" onclick={() => picker.click()} aria-label={hasPhoto ? m.perfil_trocar_foto() : m.perfil_escolher_foto()}>
	{#if preview}
		<img src={preview} alt="" style:width={`${size}px`} style:height={`${size}px`} />
	{:else}
		<Avatar {name} {publicKey} {size} {showPhoto} />
	{/if}
	<span class="badge" aria-hidden="true"><Icon name="image" size={18} /></span>
</button>
<input bind:this={picker} type="file" accept="image/*" hidden onchange={pick} data-testid={testid} />

<style>
	.photo {
		position: relative;
		align-self: center;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: none;
	}
	.photo img {
		display: block;
		border-radius: 50%;
		object-fit: cover;
	}
	.badge {
		position: absolute;
		right: -2px;
		bottom: -2px;
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		background: var(--accent);
		color: var(--accent-fg);
		border: 2px solid var(--bg);
	}
</style>
