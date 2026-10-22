<script lang="ts">
	// Um balão da conversa. first/last marcam o começo e o fim de uma sequência da mesma pessoa:
	// só o último ganha a pontinha; nos grupos, o nome vai no primeiro.
	import type { MessageRecord } from '@lerolero/core';
	import AudioPlayer from './AudioPlayer.svelte';
	import { hue } from './Avatar.svelte';
	import Icon from './Icon.svelte';
	import { formatTime } from '#lib/format.ts';

	let {
		message: m,
		mine,
		first,
		last,
		day,
		senderName,
		onmenu
	}: {
		message: MessageRecord;
		mine: boolean;
		first: boolean;
		last: boolean;
		/** dia da mensagem, lido pela data que flutua no topo ao rolar */
		day: string;
		/** só nos grupos, no primeiro balão de outra pessoa */
		senderName?: string;
		/** toque longo (celular) ou botão direito (computador) */
		onmenu: () => void;
	} = $props();

	let pressTimer: ReturnType<typeof setTimeout> | undefined;
	let pressStart = { x: 0, y: 0 };

	function onpointerdown(event: PointerEvent) {
		// botões e a barra do áudio continuam funcionando normalmente
		if ((event.target as HTMLElement).closest('button, input, a')) return;
		pressStart = { x: event.clientX, y: event.clientY };
		pressTimer = setTimeout(onmenu, 500);
	}

	const cancelPress = () => clearTimeout(pressTimer);

	// o dedo sempre treme um pouco: só cancela se andar de verdade (rolagem)
	function onpointermove(event: PointerEvent) {
		if (Math.hypot(event.clientX - pressStart.x, event.clientY - pressStart.y) > 10) cancelPress();
	}
</script>

<div class="row" class:mine class:first class:last data-day={day}>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="bubble"
		class:deleted={m.deleted}
		{onpointerdown}
		onpointerup={cancelPress}
		onpointerleave={cancelPress}
		{onpointermove}
		oncontextmenu={(e) => (e.preventDefault(), onmenu())}
	>
		{#if last}
			<svg class="tail" viewBox="0 0 10 12" aria-hidden="true">
				<path class="tail-fill" d="M10 0C10 7 6 11 0 12H10Z" />
				<path class="tail-line" d="M9.5 0C9.5 7 6 11 0.5 11.5H10" />
			</svg>
		{/if}
		{#if senderName}
			<span class="sender" style:--h={hue(m.sender)}>{senderName}</span>
		{/if}
		{#if m.deleted}
			<p class="deleted-text">
				<Icon name="trash" size={14} />
				{mine ? 'Você apagou esta mensagem' : 'Esta mensagem foi apagada'}
			</p>
		{:else if m.media?.type.startsWith('audio/')}
			<AudioPlayer media={m.media} />
		{:else if m.media}
			<p class="hint file"><Icon name="paperclip" size={16} /> Arquivo (ainda não suportado nesta versão)</p>
		{:else}
			<p>{m.text}</p>
		{/if}
		<span class="meta">
			{formatTime(m.createdAt)}
			{#if mine}
				<span class="status" title={m.status === 'pendente' ? 'Enviando' : 'Enviada'}>
					<Icon name={m.status === 'pendente' ? 'clock' : 'check'} size={13} label={m.status === 'pendente' ? 'enviando' : 'enviada'} />
				</span>
			{/if}
		</span>
	</div>
</div>

<style>
	.sender {
		display: block;
		font-size: 0.8rem;
		font-weight: 700;
		color: hsl(var(--h) 55% 38%);
	}
	@media (prefers-color-scheme: dark) {
		.sender {
			color: hsl(var(--h) 60% 70%);
		}
	}
	.row {
		display: flex;
		margin-top: 2px;
		--bubble: var(--surface);
		--bubble-line: var(--line);
	}
	.row.first {
		margin-top: 0.5rem;
	}
	.row.mine {
		justify-content: flex-end;
		--bubble: color-mix(in srgb, var(--accent) 18%, var(--surface));
		--bubble-line: transparent;
	}
	.bubble {
		position: relative;
		max-width: 80%;
		padding: 0.4rem 0.7rem 0.3rem;
		border-radius: 12px;
		background: var(--bubble);
		border: 1px solid var(--bubble-line);
		-webkit-touch-callout: none;
		user-select: none;
	}
	/* balões seguidos: o canto do lado de quem escreveu fica mais reto */
	.row:not(.first) .bubble {
		border-top-left-radius: 4px;
	}
	.row:not(.last) .bubble {
		border-bottom-left-radius: 4px;
	}
	.row.last .bubble {
		border-bottom-left-radius: 0;
	}
	.row.mine .bubble {
		border-radius: 12px;
	}
	.row.mine:not(.first) .bubble {
		border-top-right-radius: 4px;
	}
	.row.mine:not(.last) .bubble {
		border-bottom-right-radius: 4px;
	}
	.row.mine.last .bubble {
		border-bottom-right-radius: 0;
	}
	/* a pontinha passa 1px por cima da borda do balão para emendar sem risco */
	.tail {
		position: absolute;
		bottom: -1px;
		left: -10px;
		width: 10px;
		height: 12px;
		overflow: visible;
	}
	.mine .tail {
		left: auto;
		right: -10px;
		transform: scaleX(-1);
	}
	.tail-fill {
		fill: var(--bubble);
	}
	.tail-line {
		fill: none;
		stroke: var(--bubble-line);
		stroke-width: 1;
	}
	.deleted-text {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-style: italic;
		color: var(--muted);
	}
	.bubble p {
		margin: 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.meta {
		display: block;
		text-align: right;
		font-size: 0.7rem;
		color: var(--muted);
	}
	.status {
		display: inline-block;
		vertical-align: -2px;
	}
	.file {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin: 0;
	}
</style>
