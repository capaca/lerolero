<script lang="ts">
	// Arquivo no balão (RF-44): nome, tipo e tamanho. O primeiro toque só baixa (RF-71) e o seguinte salva: o app nunca
	// abre o arquivo (T22), e o compartilhar do iPhone exige um toque recente (RF-45). Bloqueado não tem toque nenhum.
	import { fileExtension, isBlockedFile, saveName, type MessageMedia } from '@lerolero/core';
	import Icon from './Icon.svelte';
	import { friendlyError } from '#lib/errors.ts';
	import { intlLocale } from '#lib/i18n.svelte.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { saveFile } from '#lib/save-file.ts';
	import { session } from '#lib/session.svelte.ts';

	let { media }: { media: MessageMedia } = $props();

	const blocked = $derived(isBlockedFile(media));
	const label = $derived(saveName(media));
	const extension = $derived(fileExtension(media.name).toUpperCase());
	const size = $derived.by(() => {
		const number = new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: 1 });
		return media.size < 1_000_000
			? m.arquivo_kb({ tamanho: number.format(Math.max(1, media.size / 1000)) })
			: m.arquivo_mb({ tamanho: number.format(media.size / 1_000_000) });
	});

	let ready = $state(false);
	let loading = $state(false);
	let error = $state('');

	$effect(() => {
		let gone = false;
		void session.downloadedMedia(media.ox).then((file) => {
			if (!gone && file) ready = true;
		});
		return () => (gone = true);
	});

	async function tap() {
		if (loading) return;
		loading = true;
		error = '';
		try {
			const file = await session.openMedia(media);
			if (ready) await saveFile(file, saveName(media));
			ready = true;
		} catch (err) {
			error = friendlyError(err);
		} finally {
			loading = false;
		}
	}
</script>

{#if blocked}
	<div class="card" data-testid="arquivo">
		<Icon name="shield" size={22} />
		<span class="text">
			<span class="name">{label}</span>
			<span class="detail">{m.arquivo_bloqueado()}</span>
		</span>
	</div>
{:else}
	<button type="button" class="card" onclick={tap} disabled={loading} data-testid="arquivo">
		<Icon name={ready ? 'download' : 'paperclip'} size={22} />
		<span class="text">
			<span class="name">{label}</span>
			<span class="detail">{extension ? `${extension} · ` : ''}{size} · {loading ? m.arquivo_baixando() : ready ? m.arquivo_tocar_salvar() : m.arquivo_tocar_baixar()}</span>
		</span>
	</button>
{/if}
{#if error}<p class="error" role="alert">{error}</p>{/if}

<style>
	.card {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		width: 100%;
		min-width: 12rem;
		padding: 0.4rem 0.2rem;
		border: 0;
		background: transparent;
		color: inherit;
		text-align: left;
		font: inherit;
	}
	.text {
		display: grid;
		min-width: 0;
	}
	.name {
		overflow-wrap: anywhere;
		font-weight: 600;
	}
	.error {
		color: var(--danger);
		font-size: 0.8rem;
	}
	.detail {
		font-size: 0.8rem;
		opacity: 0.8;
	}
</style>
