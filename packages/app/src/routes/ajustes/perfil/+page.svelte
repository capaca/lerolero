<script lang="ts">
	// Meu cartão de perfil (Q-P5, RF-02): nome e foto, que vão cifrados só para quem conversa comigo.
	import PhotoPicker from '#lib/components/PhotoPicker.svelte';
	import TopBar from '#lib/components/TopBar.svelte';
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

	const hasPhoto = $derived(chosen ? true : chosen === null ? false : !!session.photos[me]);

	$effect(() => () => {
		if (preview) URL.revokeObjectURL(preview);
	});

	function pick(file: File) {
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

<TopBar title={m.perfil_titulo()} back={resolve('/ajustes')} backTo={m.inicio_ajustes()} />

<!-- formulário com o botão embaixo, como no cadastro (item 26) -->
<main class="flow under-bar">
	<form onsubmit={submit}>
		<!-- a foto pela bolinha, como no cadastro -->
		<PhotoPicker {name} publicKey={me} {preview} {hasPhoto} showPhoto={chosen !== null} size={112} testid="foto-perfil" onpick={pick} />
		{#if hasPhoto}<button class="link remove" type="button" onclick={removePhoto}>{m.perfil_tirar_foto()}</button>{/if}
		<p class="hint center">{m.perfil_foto_dica()}</p>

		<label for="nome">{m.comum_seu_nome()}</label>
		<input id="nome" maxlength="40" autocomplete="nickname" required bind:value={name} oninput={() => (saved = false)} />
		<p class="hint">{m.perfil_privado_dica()}</p>

		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<div class="bottom">
			{#if saved}<p role="status" class="hint center">{m.perfil_salvo()}</p>{/if}
			<button class="primary" type="submit" disabled={busy || !name.trim()}>{busy ? m.perfil_salvando() : m.comum_salvar()}</button>
		</div>
	</form>
</main>

<style>
	.remove {
		align-self: center;
	}
</style>
