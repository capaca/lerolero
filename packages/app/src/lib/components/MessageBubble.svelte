<script lang="ts">
	// Um balão da conversa. first/last marcam o começo e o fim de uma sequência da mesma pessoa:
	// só o último ganha a pontinha; nos grupos, o nome vai no primeiro.
	import { splitLinks, splitMentions, withMentionLabels, type Delivery, type MessageRecord, type TextPart } from '@lerolero/core';
	import AudioPlayer from './AudioPlayer.svelte';
	import PhotoView from './PhotoView.svelte';
	import { hue } from './Avatar.svelte';
	import Icon from './Icon.svelte';
	import { formatTime } from '#lib/format.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { session } from '#lib/session.svelte.ts';

	let {
		message: msg,
		mine,
		first,
		last,
		day,
		senderName,
		links = 'texto',
		delivery = 'enviada',
		quote,
		reactions = [],
		selecting = false,
		selected = false,
		onpick,
		onlink,
		onquote,
		onreact,
		mentionLabel = (publicKey) => publicKey,
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
		/** endereços no texto (T18): 'aberto' abre direto, 'aviso' pede confirmação (`onlink`), 'texto' não vira link */
		links?: 'aberto' | 'aviso' | 'texto';
		onlink?: (href: string, host: string) => void;
		/** minhas mensagens: pendente, enviada, entregue ou lida (RF-50) */
		delivery?: Delivery;
		/** a mensagem a que esta responde (RF-22): quem escreveu e o que, ou `missing` se não está mais aqui */
		quote?: { name: string; message?: MessageRecord };
		/** reações somadas por emoji (RF-23); `mine` marca a que eu dei */
		reactions?: Array<{ emoji: string; count: number; mine: boolean }>;
		/** modo de seleção de várias mensagens (RF-28): qualquer toque no balão marca ou desmarca */
		selecting?: boolean;
		selected?: boolean;
		onpick?: () => void;
		onquote?: () => void;
		onreact?: (emoji: string) => void;
		/** como cada menção aparece ("@Ana", RF-35) */
		mentionLabel?: (publicKey: string) => string;
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

	// foto aberta ocupa o balão inteiro, como no WhatsApp; a fechada (pedido de mensagem) é só uma linha
	// mensagem apagada não entra na seleção
	const picking = $derived(selecting && !msg.deleted);
	const me = $derived(session.identity?.publicKey);
	// texto em pedaços: menções (RF-35) e, fora delas, endereços (T18)
	const parts = $derived(
		splitMentions(msg.text).flatMap((part): Array<{ text: string; mention: string } | TextPart> =>
			'mention' in part ? [part] : links === 'texto' ? [{ text: part.text }] : splitLinks(part.text)
		)
	);
	const isPhoto = $derived(!msg.deleted && !!msg.media?.type.startsWith('image/') && links !== 'texto');
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div
	class="row"
	class:mine
	class:first
	class:last
	class:selected
	data-day={day}
	data-id={msg.id}
	role={picking ? 'checkbox' : undefined}
	aria-checked={picking ? selected : undefined}
	onclickcapture={(event) => {
		// na seleção o toque em qualquer parte do balão (link, áudio, foto, citação) só marca
		if (!picking) return;
		event.preventDefault();
		event.stopPropagation();
		onpick?.();
	}}
>
	{#if picking}
		<span class="pick" class:on={selected} aria-hidden="true">{#if selected}<Icon name="check" size={14} />{/if}</span>
	{/if}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="bubble"
		class:deleted={msg.deleted}
		class:with-photo={isPhoto}
		onpointerdown={picking ? undefined : onpointerdown}
		onpointerup={cancelPress}
		onpointerleave={cancelPress}
		{onpointermove}
		oncontextmenu={(e) => (e.preventDefault(), picking || onmenu())}
	>
		{#if last}
			<svg class="tail" viewBox="0 0 10 12" aria-hidden="true">
				<path class="tail-fill" d="M10 0C10 7 6 11 0 12H10Z" />
				<path class="tail-line" d="M9.5 0C9.5 7 6 11 0.5 11.5H10" />
			</svg>
		{/if}
		{#if senderName}
			<span class="sender" style:--h={hue(msg.sender)}>{senderName}</span>
		{/if}
		{#if quote && !msg.deleted}
			<button type="button" class="quote" onclick={onquote} aria-label={m.citada_ir()}>
				<span class="quote-name">{quote.name}</span>
				<span class="quote-text">
					{#if !quote.message}
						{m.citada_indisponivel()}
					{:else if quote.message.deleted}
						{m.citada_apagada()}
					{:else if quote.message.media?.type.startsWith('audio/')}
						<Icon name="mic" size={13} /> {m.previa_audio()}
					{:else if quote.message.media?.type.startsWith('image/')}
						<Icon name="image" size={13} /> {m.previa_foto()}
					{:else if quote.message.media}
						<Icon name="paperclip" size={13} />
					{:else}
						{withMentionLabels(quote.message.text, mentionLabel)}
					{/if}
				</span>
			</button>
		{/if}
		{#if msg.deleted}
			<p class="deleted-text">
				<Icon name="trash" size={14} />
				{mine ? m.bolha_voce_apagou() : m.bolha_apagada()}
			</p>
		{:else if msg.media?.type.startsWith('audio/') && links === 'texto'}
			<!-- pedido de mensagem (RF-12): nada é baixado nem tocado até a pessoa aceitar -->
			<p class="hint file"><Icon name="mic" size={16} /> {m.bolha_audio_pedido()}</p>
		{:else if msg.media?.type.startsWith('audio/')}
			<AudioPlayer media={msg.media} />
			{#if msg.upload?.failed}
				<!-- desistiu depois de alguns minutos: pede uma decisão em vez de ficar "enviando" para sempre -->
				<p class="failed" role="alert">{m.bolha_falhou()}</p>
				<div class="failed-actions">
					<button type="button" onclick={() => session.retryUpload(msg.id)}>{m.bolha_tentar_de_novo()}</button>
					<button type="button" class="discard" onclick={() => session.discardUpload(msg.id)}>{m.bolha_apagar()}</button>
				</div>
			{/if}
		{:else if msg.media?.type.startsWith('image/') && links === 'texto'}
			<!-- pedido de mensagem (RF-12): foto fechada até aceitar -->
			<p class="hint file"><Icon name="image" size={16} /> {m.bolha_foto_pedido()}</p>
		{:else if msg.media?.type.startsWith('image/')}
			<PhotoView media={msg.media} />
			{#if msg.upload?.failed}
				<p class="failed" role="alert">{m.bolha_falhou()}</p>
				<div class="failed-actions">
					<button type="button" onclick={() => session.retryUpload(msg.id)}>{m.bolha_tentar_de_novo()}</button>
					<button type="button" class="discard" onclick={() => session.discardUpload(msg.id)}>{m.bolha_apagar()}</button>
				</div>
			{/if}
		{:else if msg.media}
			<p class="hint file"><Icon name="paperclip" size={16} /> {m.bolha_arquivo()}</p>
		{:else}
			<p>
				{#each parts as part, i (i)}
					{#if 'mention' in part}
						<span class="mention" class:me={part.mention === me}>{mentionLabel(part.mention)}</span>
					{:else if 'href' in part && links === 'aviso'}
						<a
							href={part.href}
							target="_blank"
							rel="noopener noreferrer"
							onclick={(e) => (e.preventDefault(), onlink?.(part.href, part.host))}>{part.text}</a
						>
					{:else if 'href' in part}
						<a href={part.href} target="_blank" rel="noopener noreferrer">{part.text}</a>
					{:else}
						{part.text}
					{/if}
				{/each}
			</p>
		{/if}
		{#if reactions.length && !msg.deleted}
			<div class="reactions">
				{#each reactions as reaction (reaction.emoji)}
					<button
						type="button"
						class="chip"
						class:mine={reaction.mine}
						aria-pressed={reaction.mine}
						aria-label={m.reacao_chip({ emoji: reaction.emoji, count: reaction.count })}
						onclick={() => onreact?.(reaction.emoji)}
					>
						{reaction.emoji}{#if reaction.count > 1}<span class="count">{reaction.count}</span>{/if}
					</button>
				{/each}
			</div>
		{/if}
		<span class="meta">
			{#if msg.starred}<span class="star"><Icon name="star" size={12} label={m.bolha_favorita()} /></span>{/if}
			{#if msg.editedAt && !msg.deleted}<span class="edited">{m.bolha_editada()}</span>{/if}
			{formatTime(msg.createdAt)}
			{#if mine && !msg.upload?.failed}
				{@const label = { pendente: m.bolha_enviando(), enviada: m.bolha_enviada(), entregue: m.bolha_entregue(), lida: m.bolha_lida() }[delivery]}
				<span class="status" class:delivered={delivery === 'entregue'} class:read={delivery === 'lida'} title={label}>
					<Icon name={delivery === 'pendente' ? 'clock' : delivery === 'enviada' ? 'check' : 'check-check'} size={13} {label} />
				</span>
			{/if}
		</span>
	</div>
</div>

<style>
	.mention {
		font-weight: 600;
		color: var(--accent);
	}
	/* fui eu o mencionado: destaque mais forte (RF-35) */
	.mention.me {
		padding: 0 0.2em;
		border-radius: 4px;
		background: color-mix(in srgb, var(--accent) 22%, transparent);
	}
	.edited {
		margin-right: 0.25rem;
	}
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
	/* balão de foto: a foto vai quase de borda a borda, na largura que a tela der */
	.bubble.with-photo {
		width: min(80%, 24rem);
		padding: 3px;
	}
	.bubble.with-photo .sender,
	.bubble.with-photo .failed,
	.bubble.with-photo .failed-actions {
		margin-left: 0.4rem;
		margin-right: 0.4rem;
	}
	.bubble.with-photo .meta {
		padding: 0 0.4rem;
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
	.bubble p a {
		color: var(--accent);
		text-decoration: underline;
	}
	.failed {
		margin: 0.3rem 0 0;
		font-size: 0.85rem;
		color: var(--danger);
		font-weight: 600;
	}
	.failed-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.3rem;
	}
	.failed-actions button {
		min-height: 2.75rem;
		padding: 0 0.9rem;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: inherit;
		font: inherit;
		font-weight: 600;
	}
	.failed-actions .discard {
		color: var(--danger);
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
	.star {
		display: inline-block;
		vertical-align: -1px;
		margin-right: 0.15rem;
	}
	.star :global(svg) {
		fill: currentColor;
	}
	.row.selected {
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		margin-left: -0.5rem;
		margin-right: -0.5rem;
		padding: 0 0.5rem;
	}
	.pick {
		flex-shrink: 0;
		align-self: center;
		display: grid;
		place-items: center;
		width: 1.3rem;
		height: 1.3rem;
		margin-right: 0.5rem;
		border: 2px solid var(--muted);
		border-radius: 50%;
	}
	.pick.on {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--accent-fg);
	}
	/* na minha fileira o balão vai à direita, e a marca fica na borda esquerda */
	.row.mine .pick {
		margin-right: auto;
	}
	/* entregue: tom do texto, bem mais escuro que o cinza do horário, que sumia no verde do balão */
	.status.delivered {
		color: var(--fg);
	}
	.status.read {
		color: var(--read);
	}
	/* a mensagem citada: faixa colorida à esquerda, como nos outros apps */
	.quote {
		display: block;
		width: 100%;
		margin: 0 0 0.25rem;
		padding: 0.2rem 0.5rem;
		border: 0;
		border-left: 3px solid var(--accent);
		border-radius: 6px;
		background: color-mix(in srgb, var(--fg) 7%, transparent);
		color: inherit;
		font: inherit;
		font-size: 0.85rem;
		text-align: left;
	}
	.quote-name {
		display: block;
		font-weight: 700;
		color: var(--accent);
	}
	.quote-text {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		color: var(--muted);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.reactions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin-top: 0.25rem;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		min-height: 1.75rem;
		padding: 0 0.45rem;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: inherit;
		font: inherit;
		font-size: 0.85rem;
	}
	.chip.mine {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 15%, var(--surface));
	}
	.count {
		font-size: 0.75rem;
		font-weight: 600;
	}
	.file {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin: 0;
	}
</style>
