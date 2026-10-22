<script lang="ts">
	// Conversa (1:1 ou grupo): mensagens, avisos de grupo, menu da mensagem e campo de envio.
	// O topo e os avisos de cima ficam com a tela que usa o componente.
	import { describeNotice, MAX_TEXT_LENGTH, type MessageRecord } from '@lerolero/core';
	import { onDestroy, tick, type Snippet } from 'svelte';
	import AudioPlayer from './AudioPlayer.svelte';
	import { hue } from './Avatar.svelte';
	import Icon from './Icon.svelte';
	import MessageMenu from './MessageMenu.svelte';
	import { dayKey, formatDay, formatTime } from '#lib/format.ts';
	import { MAX_SECONDS, startRecording, type Recording } from '#lib/recorder.ts';
	import { friendlyError, session } from '#lib/session.svelte.ts';

	let {
		conversationId,
		header,
		banner,
		nameOf,
		closed
	}: {
		conversationId: string;
		header: Snippet;
		banner?: Snippet;
		/** só nos grupos: nome de cada membro ("Você", contato, "~Nome"), para os balões e os avisos */
		nameOf?: (publicKey: string) => string;
		/** sem envio (ex.: saí do grupo): o texto aparece no lugar do campo */
		closed?: string;
	} = $props();

	// Abre com as últimas mensagens; as anteriores vêm sob demanda. As mensagens ficam
	// em blocos com content-visibility: o modo que rolou melhor no celular (prototipos/medicao).
	const PAGE_SIZE = 200;
	const BLOCK_SIZE = 50;

	const me = session.identity?.publicKey;

	let loaded = $state(false);
	let messages = $state.raw<MessageRecord[]>([]);
	let hasOlder = $state(false);
	let extraPages = 0;
	let firstLoad = true;
	let text = $state('');
	let error = $state('');
	let scroller = $state<HTMLDivElement>();
	let input = $state<HTMLTextAreaElement>();

	// gravação de áudio: um toque começa, outro envia (RF-40)
	let recording = $state<Recording>();
	let elapsed = $state(0);
	let sendingAudio = $state(false);
	let ticker: ReturnType<typeof setInterval> | undefined;

	async function startAudio() {
		error = '';
		try {
			recording = await startRecording();
			elapsed = 0;
			ticker = setInterval(() => {
				elapsed = Math.floor((performance.now() - recording!.startedAt) / 1000);
				if (elapsed >= MAX_SECONDS) void finishAudio();
			}, 250);
		} catch (err) {
			error = friendlyError(err);
		}
	}

	function stopTicker() {
		clearInterval(ticker);
		ticker = undefined;
	}

	function cancelAudio() {
		stopTicker();
		recording?.cancel();
		recording = undefined;
	}

	async function finishAudio() {
		const current = recording;
		if (!current) return;
		stopTicker();
		recording = undefined;
		const { file, duration } = await current.stop();
		if (duration < 1) return; // toque sem querer
		sendingAudio = true;
		try {
			await session.sendAudio(conversationId, file, duration);
		} catch (err) {
			error = friendlyError(err);
		} finally {
			sendingAudio = false;
		}
	}

	onDestroy(cancelAudio);

	// menu da mensagem: toque longo (celular) ou botão direito (computador)
	let menuFor = $state.raw<MessageRecord>();
	let pressTimer: ReturnType<typeof setTimeout> | undefined;
	let pressStart = { x: 0, y: 0 };

	function openMenu(message: MessageRecord) {
		if (message.deleted || message.notice) return;
		menuFor = message;
	}

	function onpointerdown(event: PointerEvent, message: MessageRecord) {
		// botões e a barra do áudio continuam funcionando normalmente
		if ((event.target as HTMLElement).closest('button, input, a')) return;
		pressStart = { x: event.clientX, y: event.clientY };
		pressTimer = setTimeout(() => openMenu(message), 500);
	}

	const cancelPress = () => clearTimeout(pressTimer);

	// o dedo sempre treme um pouco: só cancela se andar de verdade (rolagem)
	function onpointermove(event: PointerEvent) {
		if (Math.hypot(event.clientX - pressStart.x, event.clientY - pressStart.y) > 10) cancelPress();
	}

	async function deleteMessage(forEveryone: boolean) {
		const message = menuFor;
		menuFor = undefined;
		if (!message) return;
		try {
			if (forEveryone) await session.deleteForEveryone(conversationId, message.id);
			else await session.deleteForMe(message.id);
		} catch (err) {
			error = friendlyError(err);
		}
	}
	const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

	type Item = { type: 'dia'; key: number; label: string } | { type: 'msg'; message: MessageRecord };
	const blocks = $derived.by(() => {
		const items: Item[] = [];
		let lastDay: number | undefined;
		for (const message of messages) {
			const day = dayKey(message.createdAt);
			if (day !== lastDay) items.push({ type: 'dia', key: day, label: formatDay(message.createdAt) });
			lastDay = day;
			items.push({ type: 'msg', message });
		}
		const out: Item[][] = [];
		for (let i = 0; i < items.length; i += BLOCK_SIZE) out.push(items.slice(i, i + BLOCK_SIZE));
		return out;
	});

	const nearBottom = () => !scroller || scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 150;

	// O teclado encolhe a área das mensagens: quem estava no fim continua vendo as últimas.
	let atEnd = true;
	const onscroll = () => (atEnd = !!scroller && scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 8);
	$effect(() => {
		if (!scroller) return;
		const el = scroller;
		const observer = new ResizeObserver(() => {
			if (atEnd) el.scrollTop = el.scrollHeight;
		});
		observer.observe(el);
		return () => observer.disconnect();
	});

	async function load() {
		const limit = PAGE_SIZE * (1 + extraPages);
		const list = await session.getMessages(conversationId, limit + 1);
		const stick = firstLoad || nearBottom() || list.at(-1)?.sender === me;
		hasOlder = list.length > limit;
		messages = hasOlder ? list.slice(1) : list;
		loaded = true;
		await tick();
		if (stick && scroller) scroller.scrollTop = scroller.scrollHeight;
		firstLoad = false;
		if ((await session.getConversation(conversationId))?.unread) await session.markRead(conversationId);
	}

	// recarrega quando muda a conversa ou chega/sai qualquer mensagem (session.version)
	$effect(() => {
		void session.version;
		session.openConversationId = conversationId;
		void load();
	});
	// conecta já aos relays de quem recebe, para a primeira mensagem não esperar a conexão
	$effect(() => {
		let release: (() => void) | undefined;
		let gone = false;
		void session.prepareConversation(conversationId).then((r) => (gone ? r() : (release = r)));
		return () => {
			gone = true;
			release?.();
		};
	});
	onDestroy(() => (session.openConversationId = undefined));

	async function loadOlder() {
		const before = scroller!.scrollHeight;
		extraPages++;
		await load();
		// mantém na tela a mensagem que a pessoa estava lendo
		scroller!.scrollTop += scroller!.scrollHeight - before;
	}

	async function send(event?: SubmitEvent) {
		event?.preventDefault();
		const message = text.trim();
		if (!message) return;
		error = '';
		text = '';
		try {
			await session.sendText(conversationId, message);
		} catch (err) {
			text = message;
			error = friendlyError(err);
		}
		input?.focus();
	}

	// no computador, Enter envia e Shift+Enter quebra a linha; no celular, Enter quebra a linha
	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey && matchMedia('(pointer: fine)').matches) {
			event.preventDefault();
			void send();
		}
	}

	/** Nome em cima do balão: nos grupos, na primeira de uma sequência de mensagens da mesma pessoa. */
	function showSender(m: MessageRecord, i: number, block: Item[]): boolean {
		if (!nameOf || m.sender === me || m.notice) return false;
		const previous = block[i - 1];
		return previous?.type !== 'msg' || previous.message.sender !== m.sender || !!previous.message.notice;
	}
</script>

<div class="chat">
	{@render header()}
	{@render banner?.()}

	<div class="messages" bind:this={scroller} {onscroll} aria-live="polite">
		{#if hasOlder}
			<button class="link older" onclick={loadOlder}>Carregar mensagens anteriores</button>
		{/if}
		{#if messages.length === 0 && loaded}
			<p class="hint empty">Nenhuma mensagem ainda. Diga oi!</p>
		{/if}
		{#each blocks as block, b (b)}
			<div class="block" style:--block-estimate="{block.length * 56}px">
				{#each block as item, i (item.type === 'dia' ? `d${item.key}` : item.message.id)}
					{#if item.type === 'dia'}
						<p class="day">{item.label}</p>
					{:else if item.message.notice}
						<p class="notice-line">{nameOf ? describeNotice(item.message.notice, item.message.sender, nameOf) : item.message.text}</p>
					{:else}
						{@const m = item.message}
						<div class="row" class:mine={m.sender === me}>
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="bubble"
								class:deleted={m.deleted}
								onpointerdown={(e) => onpointerdown(e, m)}
								onpointerup={cancelPress}
								onpointerleave={cancelPress}
								{onpointermove}
								oncontextmenu={(e) => (e.preventDefault(), openMenu(m))}
							>
								{#if showSender(m, i, block)}
									<span class="sender" style:--h={hue(m.sender)}>{nameOf!(m.sender)}</span>
								{/if}
								{#if m.deleted}
									<p class="deleted-text">
										<Icon name="trash" size={14} />
										{m.sender === me ? 'Você apagou esta mensagem' : 'Esta mensagem foi apagada'}
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
									{#if m.sender === me}
										<span class="status" title={m.status === 'pendente' ? 'Enviando' : 'Enviada'}>
											<Icon name={m.status === 'pendente' ? 'clock' : 'check'} size={13} label={m.status === 'pendente' ? 'enviando' : 'enviada'} />
										</span>
									{/if}
								</span>
							</div>
						</div>
					{/if}
				{/each}
			</div>
		{/each}
	</div>

	{#if menuFor}
		<MessageMenu
			mine={menuFor.sender === me}
			group={!!nameOf}
			onclose={() => (menuFor = undefined)}
			ondeleteForMe={() => deleteMessage(false)}
			ondeleteForEveryone={() => deleteMessage(true)}
		/>
	{/if}

	<form class="composer" onsubmit={send}>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		{#if closed}
			<p class="hint closed" role="status">{closed}</p>
		{:else if recording}
			<div class="line recording" role="status">
				<button type="button" class="round ghost" onclick={cancelAudio} aria-label="Cancelar gravação">
					<Icon name="trash" />
				</button>
				<span class="dot" aria-hidden="true"></span>
				<span class="elapsed">Gravando {clock(elapsed)}</span>
				<button type="button" class="round primary" onclick={finishAudio} aria-label="Enviar áudio">
					<Icon name="send" />
				</button>
			</div>
		{:else if sendingAudio}
			<p class="hint sending" role="status"><Icon name="loader" size={16} /> Enviando áudio…</p>
		{:else}
			<div class="line">
				<textarea
					bind:this={input}
					bind:value={text}
					{onkeydown}
					rows="1"
					maxlength={MAX_TEXT_LENGTH}
					placeholder="Mensagem"
					aria-label="Mensagem"
				></textarea>
				{#if text.trim()}
					<button class="round primary" type="submit" aria-label="Enviar"><Icon name="send" /></button>
				{:else}
					<button class="round primary" type="button" onclick={startAudio} aria-label="Gravar áudio"><Icon name="mic" /></button>
				{/if}
			</div>
		{/if}
	</form>
</div>

<style>
	.chat {
		height: 100dvh;
		display: flex;
		flex-direction: column;
		max-width: 720px;
		margin: 0 auto;
	}
	.notice-line {
		text-align: center;
		margin: 0.5rem auto;
		max-width: 85%;
		padding: 0.25rem 0.7rem;
		border-radius: 8px;
		background: var(--surface);
		color: var(--muted);
		font-size: 0.82rem;
		width: fit-content;
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
	.closed {
		text-align: center;
		margin: 0.4rem 0;
	}
	.messages {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem 0.8rem;
		overflow-anchor: none;
		display: flex;
		flex-direction: column;
	}
	/* poucas mensagens ficam junto do campo, como nos outros apps; com muitas, a margem some */
	.messages > :first-child {
		margin-top: auto;
	}
	.block {
		content-visibility: auto;
		contain-intrinsic-size: auto var(--block-estimate);
	}
	.older {
		display: block;
		margin: 0.5rem auto;
	}
	.empty {
		text-align: center;
		margin-top: 2rem;
	}
	.day {
		text-align: center;
		color: var(--muted);
		font-size: 0.8rem;
		margin: 0.9rem 0 0.4rem;
	}
	.row {
		display: flex;
		margin: 2px 0;
	}
	.row.mine {
		justify-content: flex-end;
	}
	.bubble {
		max-width: 80%;
		padding: 0.4rem 0.7rem 0.3rem;
		border-radius: 12px;
		background: var(--surface);
		border: 1px solid var(--line);
	}
	.mine .bubble {
		background: color-mix(in srgb, var(--accent) 18%, var(--surface));
		border-color: transparent;
	}
	.bubble {
		-webkit-touch-callout: none;
		user-select: none;
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
	.composer {
		padding: 0.6rem 0.8rem calc(0.6rem + env(safe-area-inset-bottom));
		border-top: 1px solid var(--line);
		background: var(--surface);
	}
	.composer .error {
		margin: 0 0 0.4rem;
	}
	.line {
		display: flex;
		gap: 0.5rem;
		align-items: flex-end;
	}
	.recording {
		align-items: center;
	}
	.elapsed {
		flex: 1;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	.dot {
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 50%;
		background: var(--danger);
		animation: pulse 1s infinite alternate;
	}
	@keyframes pulse {
		to {
			opacity: 0.3;
		}
	}
	.file {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin: 0;
	}
	.round {
		width: 2.9rem;
		height: 2.9rem;
		border-radius: 50%;
		padding: 0;
		display: grid;
		place-items: center;
		flex-shrink: 0;
	}
	.round.ghost {
		border-color: transparent;
		background: transparent;
		color: var(--muted);
	}
	.status {
		display: inline-block;
		vertical-align: -2px;
	}
	.sending {
		margin: 0.4rem 0;
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 0.4rem;
	}
	textarea {
		flex: 1;
		resize: none;
		max-height: 8rem;
		field-sizing: content;
	}
</style>
