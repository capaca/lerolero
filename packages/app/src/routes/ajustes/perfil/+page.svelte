<script lang="ts">
	// Meu cartão de perfil (Q-P5, RF-02): nome e foto, que vão cifrados só para quem conversa comigo.
	import Avatar from '#lib/components/Avatar.svelte';
	import BackLink from '#lib/components/BackLink.svelte';
	import { resolve } from '$app/paths';
	import { friendlyError } from '#lib/errors.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { session } from '#lib/session.svelte.ts';

	const me = $derived(session.identity?.publicKey ?? '');
	let name = $state(session.identity?.displayName ?? '');
	/** foto escolhida e ainda não salva; `null` = tirar a atual */
	let chosen = $state<Blob | null | undefined>();
	let preview = $state<string>();
	let busy = $state(false);
	let saved = $state(false);
	let error = $state('');
	let picker: HTMLInputElement;

	const hasPhoto = $derived(chosen ? true : chosen === null ? false : !!session.photos[me]);

	$effect(() => () => {
		if (preview) URL.revokeObjectURL(preview);
	});

	function pick(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		if (preview) URL.revokeObjectURL(preview);
		chosen = file;
		preview = URL.createObjectURL(file);
		saved = false;
	}

	function removePhoto() {
		if (preview) URL.revokeObjectURL(preview);
		preview = undefined;
		chosen = null;
		saved = false;
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = '';
		try {
			await session.updateProfile(name, chosen);
			if (preview) URL.revokeObjectURL(preview);
			preview = undefined;
			chosen = undefined;
			saved = true;
		} catch (err) {
			error = friendlyError(err);
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>{m.titulo_pagina({ pagina: m.perfil_titulo() })}</title></svelte:head>

<main>
	<BackLink href={resolve('/ajustes')} label={m.inicio_ajustes()} />
	<h1>{m.perfil_titulo()}</h1>

	<form onsubmit={submit}>
		<div class="photo">
			{#if preview}
				<img class="preview" src={preview} alt={m.perfil_foto_nova()} />
			{:else}
				<Avatar {name} publicKey={me} size={112} showPhoto={chosen !== null} />
			{/if}
			<div class="actions stack">
				<button type="button" onclick={() => picker.click()}>{hasPhoto ? m.perfil_trocar_foto() : m.perfil_escolher_foto()}</button>
				<input bind:this={picker} type="file" accept="image/*" hidden onchange={pick} data-testid="foto-perfil" />
				{#if hasPhoto}<button type="button" onclick={removePhoto}>{m.perfil_tirar_foto()}</button>{/if}
			</div>
		</div>
		<p class="hint">{m.perfil_foto_dica()}</p>

		<label for="nome">{m.comum_seu_nome()}</label>
		<input id="nome" maxlength="40" autocomplete="nickname" required bind:value={name} oninput={() => (saved = false)} />
		<p class="hint">{m.perfil_privado_dica()}</p>

		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<div class="actions">
			<button class="primary" type="submit" disabled={busy || !name.trim()}>{busy ? m.perfil_salvando() : m.comum_salvar()}</button>
			{#if saved}<span role="status" class="hint">{m.perfil_salvo()}</span>{/if}
		</div>
	</form>
</main>

<style>
	.photo {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		margin-bottom: 0.5rem;
	}
	.preview {
		width: 112px;
		height: 112px;
		border-radius: 50%;
		object-fit: cover;
		flex-shrink: 0;
	}
</style>
