<script module lang="ts">
	// Fotos já abertas, por hash: sair da conversa e voltar recria o balão, que não pode voltar ao borrão nem baixar
	// de novo. Ficam até fechar o app (são poucas, de até 200 KB cada).
	const opened = new Map<string, string>();
</script>

<script lang="ts">
	// Foto no balão (RF-41): a prévia da mensagem aparece na hora, com o espaço já reservado pelo tamanho;
	// o arquivo só é baixado ao tocar e abre em tela cheia.
	import type { MessageMedia } from '@lerolero/core';

	// Os blocos da conversa usam content-visibility (contain: layout), que faz o position: fixed valer em relação ao
	// bloco e não à tela: a foto aberta vazava para baixo. Levar para o body resolve.
	function toBody(node: HTMLElement) {
		document.body.appendChild(node);
		return { destroy: () => node.remove() };
	}
	import Icon from './Icon.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { session } from '#lib/session.svelte.ts';

	let { media }: { media: MessageMedia } = $props();

	let src = $state<string | undefined>(opened.get(media.x));
	let open = $state(false);
	let loading = $state(false);
	let error = $state('');

	const ratio = $derived(media.width && media.height ? `${media.width} / ${media.height}` : '4 / 3');
	const thumb = $derived(media.thumb ? `data:image/jpeg;base64,${media.thumb}` : undefined);

	async function show() {
		error = '';
		if (!src) {
			loading = true;
			try {
				src = URL.createObjectURL(await session.openMedia(media));
				opened.set(media.x, src);
			} catch {
				error = m.bolha_foto_erro();
				return;
			} finally {
				loading = false;
			}
		}
		open = true;
	}

</script>

<button type="button" class="photo" style:aspect-ratio={ratio} onclick={show} aria-label={m.bolha_foto_abrir()}>
	{#if src}
		<!-- já baixada: o balão mostra a foto de verdade, nítida, e não mais a prévia -->
		<img {src} alt="" class="sharp" />
	{:else}
		{#if thumb}<img src={thumb} alt="" />{/if}
		<span class="spin">
			{#if loading}<Icon name="loader" />{:else}<span class="badge"><Icon name="image" /></span>{/if}
		</span>
	{/if}
</button>
{#if error}<p class="hint" role="alert">{error}</p>{/if}

{#if open && src}
	<div class="full" use:toBody role="dialog" aria-modal="true" aria-label={m.bolha_foto_abrir()}>
		<button type="button" class="close" onclick={() => (open = false)} aria-label={m.bolha_foto_fechar()}><Icon name="x" /></button>
		<img src={src} alt="" data-testid="foto-aberta" />
	</div>
{/if}

<style>
	.photo {
		display: block;
		position: relative;
		width: 100%;
		/* foto em pé muito alta é cortada (cover), para não ocupar a tela inteira */
		max-height: min(30rem, 60dvh);
		padding: 0;
		border: 0;
		border-radius: 9px;
		overflow: hidden;
		background: var(--line);
	}
	/* a prévia tem só 96 px: esticada fica serrilhada, então o desfoque é proposital (como no WhatsApp e no Telegram).
	   A escala maior esconde a borda clara que o blur faz nas pontas. */
	.photo img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		filter: blur(12px) saturate(1.15);
		transform: scale(1.12);
	}
	.photo img.sharp {
		filter: none;
		transform: none;
	}
	.spin {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		color: #fff;
	}
	/* avisa que a foto de verdade abre ao tocar */
	.badge {
		display: grid;
		place-items: center;
		width: 3rem;
		height: 3rem;
		border-radius: 50%;
		background: #0006;
	}
	.full {
		position: fixed;
		inset: 0;
		z-index: 50;
		background: #000e;
		display: grid;
		place-items: center;
		overflow: hidden;
	}
	/* em unidades da tela: a % de altura não resolve num grid de altura automática */
	.full img {
		max-width: 100vw;
		max-height: 100dvh;
		object-fit: contain;
	}
	.close {
		position: absolute;
		top: calc(0.6rem + env(safe-area-inset-top));
		right: 0.6rem;
		color: #fff;
		background: #0008;
		border-radius: 50%;
		width: 2.5rem;
		height: 2.5rem;
		display: grid;
		place-items: center;
		border: 0;
	}
</style>
