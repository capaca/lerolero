<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { contactName, directConversationId, MAX_TEXT_LENGTH, toNpub, type ContactRecord, type MessageRecord } from '@lerolero/core';
	import { onDestroy, tick } from 'svelte';
	import AudioPlayer from '#lib/components/AudioPlayer.svelte';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import MessageMenu from '#lib/components/MessageMenu.svelte';
	import { dayKey, formatDay, formatTime } from '#lib/format.ts';
	import { MAX_SECONDS, startRecording, type Recording } from '#lib/recorder.ts';
	import { friendlyError, session } from '#lib/session.svelte.ts';

	// Abre com as últimas mensagens; as anteriores vêm sob demanda. As mensagens ficam
	// em blocos com content-visibility: o modo que rolou melhor no celular (prototipos/medicao).
	const PAGE_SIZE = 200;
	const BLOCK_SIZE = 50;

	const publicKey = $derived(page.params.chave ?? '');
	const me = session.identity?.publicKey;

	let contact = $state.raw<ContactRecord | null>();
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
			await session.sendAudio(publicKey, file, duration);
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
		if (message.deleted) return;
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
			if (forEveryone) await session.deleteForEveryone(publicKey, message.id);
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

	async function load() {
		const limit = PAGE_SIZE * (1 + extraPages);
		const list = await session.getMessages(publicKey, limit + 1);
		const stick = firstLoad || nearBottom() || list.at(-1)?.sender === me;
		hasOlder = list.length > limit;
		messages = hasOlder ? list.slice(1) : list;
		contact = (await session.getContact(publicKey)) ?? null;
		await tick();
		if (stick && scroller) scroller.scrollTop = scroller.scrollHeight;
		firstLoad = false;
		if ((await session.getConversation(publicKey))?.unread) await session.markRead(publicKey);
	}

	// recarrega quando muda a conversa ou chega/sai qualquer mensagem (session.version)
	$effect(() => {
		void session.version;
		session.openConversationId = directConversationId(publicKey);
		void load();
	});
	// conecta já aos relays do contato, para a primeira mensagem não esperar a conexão
	$effect(() => {
		let release: (() => void) | undefined;
		let gone = false;
		void session.prepareConversation(publicKey).then((r) => (gone ? r() : (release = r)));
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
			await session.sendText(publicKey, message);
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

	const name = $derived(contact ? contactName(contact) : contact === null ? `${toNpub(publicKey).slice(0, 12)}…` : '');
	const isContact = $derived(contact?.state === 'aceito');
	const inviteHash = $derived(`#${toNpub(publicKey)}${contact?.chosenName ? `&n=${encodeURIComponent(contact.chosenName)}` : ''}`);
</script>

<svelte:head><title>{name || 'Conversa'} · Lero-lero</title></svelte:head>

<div class="chat">
	<header>
		<a class="back" href={resolve('/')} aria-label="Voltar para as conversas"><Icon name="back" size={22} /></a>
		{#if isContact}
			<a class="who" href={resolve('/contatos/[chave]', { chave: publicKey })}>
				<Avatar name={contact ? contactName(contact) : undefined} {publicKey} size={36} />
				<span class="name">{name}</span>
			</a>
		{:else}
			<span class="who">
				<Avatar {publicKey} size={36} />
				<span class="name">{name}</span>
			</span>
		{/if}
	</header>

	{#if contact !== undefined && !isContact}
		<div class="banner notice">
			<p>
				<strong>Esta pessoa não está nos seus contatos.</strong>
				{#if contact?.chosenName}Ela se apresenta como “{contact.chosenName}”, mas qualquer um pode escolher qualquer nome.{/if}
			</p>
			<a href={resolve('/convite') + inviteHash}>Adicionar aos contatos</a>
		</div>
	{/if}

	<div class="messages" bind:this={scroller} aria-live="polite">
		{#if hasOlder}
			<button class="link older" onclick={loadOlder}>Carregar mensagens anteriores</button>
		{/if}
		{#if messages.length === 0 && contact !== undefined}
			<p class="hint empty">Nenhuma mensagem ainda. Diga oi!</p>
		{/if}
		{#each blocks as block, b (b)}
			<div class="block" style:--block-estimate="{block.length * 56}px">
				{#each block as item (item.type === 'dia' ? `d${item.key}` : item.message.id)}
					{#if item.type === 'dia'}
						<p class="day">{item.label}</p>
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
			onclose={() => (menuFor = undefined)}
			ondeleteForMe={() => deleteMessage(false)}
			ondeleteForEveryone={() => deleteMessage(true)}
		/>
	{/if}

	<form class="composer" onsubmit={send}>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		{#if recording}
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
	header {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		padding: 0.5rem 1rem;
		border-bottom: 1px solid var(--line);
		background: var(--surface);
	}
	header a {
		text-decoration: none;
		font-size: 1.2rem;
	}
	.who {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-width: 0;
	}
	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 700;
		font-size: 1.05rem;
		color: var(--fg);
	}
	.notice {
		margin: 0.6rem 1rem 0;
	}
	.messages {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem 0.8rem;
		overflow-anchor: none;
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
	.back {
		display: grid;
		place-items: center;
		color: var(--fg);
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
