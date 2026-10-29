<script lang="ts">
	// Campo de envio da conversa: texto, ou gravação de áudio quando o campo está vazio.
	import { MAX_TEXT_LENGTH } from '@lerolero/core';
	import { onDestroy } from 'svelte';
	import Icon from './Icon.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { MAX_SECONDS, startRecording, type Recording } from '#lib/recorder.ts';
	import { friendlyError } from '#lib/errors.ts';
	import { session } from '#lib/session.svelte.ts';

	let {
		conversationId,
		closed,
		reply,
		onclearReply,
		error = $bindable('')
	}: {
		conversationId: string;
		/** sem envio (ex.: saí do grupo): o texto aparece no lugar do campo */
		closed?: string;
		/** a mensagem que o texto vai responder (RF-22); vale só para texto, áudio e foto seguem como mensagem nova */
		reply?: { id: string; name: string; preview: string };
		onclearReply?: () => void;
		/** erros da conversa toda (enviar, copiar, apagar) aparecem aqui, acima do campo */
		error?: string;
	} = $props();

	let text = $state('');
	let input = $state<HTMLTextAreaElement>();

	// gravação de áudio: um toque começa, outro envia (RF-40)
	let recording = $state<Recording>();
	let elapsed = $state(0);
	let level = $state(0);
	let ticker: ReturnType<typeof setInterval> | undefined;

	async function startAudio() {
		error = '';
		try {
			recording = await startRecording();
			elapsed = 0;
			level = 0;
			ticker = setInterval(() => {
				level = recording!.level();
				elapsed = Math.floor((performance.now() - recording!.startedAt) / 1000);
				if (elapsed >= MAX_SECONDS) void finishAudio();
			}, 100);
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
		const { file, duration, start } = await current.stop();
		if (duration < 1) return; // toque sem querer
		try {
			await session.sendAudio(conversationId, file, duration, start);
		} catch (err) {
			error = friendlyError(err);
		}
	}

	// foto da galeria (RF-41): o seletor do sistema devolve o arquivo, o resto é por trás do balão
	let picker = $state<HTMLInputElement>();

	async function pickPhoto() {
		// várias de uma vez: uma por mensagem, na ordem escolhida; a falha de uma não derruba as outras
		const files = [...(picker?.files ?? [])];
		if (picker) picker.value = '';
		if (!files.length) return;
		error = '';
		for (const file of files) {
			try {
				await session.sendPhoto(conversationId, file);
			} catch (err) {
				error = friendlyError(err);
			}
		}
	}

	onDestroy(cancelAudio);

	// ao escolher "Responder", o teclado já abre no campo
	$effect(() => {
		if (reply) input?.focus();
	});

	const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

	async function send(event?: SubmitEvent) {
		event?.preventDefault();
		const message = text.trim();
		if (!message) return;
		error = '';
		text = '';
		try {
			await session.sendText(conversationId, message, reply?.id);
			onclearReply?.();
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
</script>

<form class="composer" onsubmit={send}>
	{#if error}<p class="error" role="alert">{error}</p>{/if}
	{#if closed}
		<p class="hint closed" role="status">{closed}</p>
	{:else if recording}
		<div class="line recording" role="status">
			<button type="button" class="round ghost" onclick={cancelAudio} aria-label={m.envio_cancelar_gravacao()}>
				<Icon name="trash" />
			</button>
			<span class="dot" aria-hidden="true"></span>
			<span class="elapsed">{m.envio_gravando({ tempo: clock(elapsed) })}</span>
			<span class="meter" aria-hidden="true"><span style:width="{Math.round(level * 100)}%"></span></span>
			<button type="button" class="round primary" onclick={finishAudio} aria-label={m.envio_enviar_audio()}>
				<Icon name="send" />
			</button>
		</div>
	{:else}
		{#if reply}
			<div class="reply">
				<span class="reply-text">
					<strong>{m.resposta_para({ nome: reply.name })}</strong>
					<span>{reply.preview}</span>
				</span>
				<button type="button" class="round ghost" onclick={onclearReply} aria-label={m.resposta_cancelar()}>
					<Icon name="x" />
				</button>
			</div>
		{/if}
		<div class="line">
			<input bind:this={picker} type="file" accept="image/*" multiple hidden onchange={pickPhoto} data-testid="foto" />
			<button type="button" class="round ghost" onclick={() => picker?.click()} aria-label={m.envio_foto()}>
				<Icon name="image" />
			</button>
			<textarea
				bind:this={input}
				bind:value={text}
				{onkeydown}
				rows="1"
				maxlength={MAX_TEXT_LENGTH}
				placeholder={m.envio_mensagem()}
				aria-label={m.envio_mensagem()}
			></textarea>
			{#if text.trim()}
				<button class="round primary" type="submit" aria-label={m.envio_enviar()}><Icon name="send" /></button>
			{:else}
				<button class="round primary" type="button" onclick={startAudio} aria-label={m.envio_gravar()}><Icon name="mic" /></button>
			{/if}
		</div>
	{/if}
</form>

<style>
	.composer {
		padding: 0.6rem 0.8rem calc(0.6rem + env(safe-area-inset-bottom));
		border-top: 1px solid var(--line);
		background: var(--surface);
	}
	.composer .error {
		margin: 0 0 0.4rem;
	}
	.closed {
		text-align: center;
		margin: 0.4rem 0;
	}
	.line {
		display: flex;
		gap: 0.5rem;
		align-items: flex-end;
	}
	.reply {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.4rem;
		padding: 0.25rem 0.25rem 0.25rem 0.6rem;
		border-left: 3px solid var(--accent);
		border-radius: 6px;
		background: color-mix(in srgb, var(--fg) 7%, transparent);
		font-size: 0.85rem;
	}
	.reply-text {
		flex: 1;
		min-width: 0;
	}
	.reply-text strong {
		display: block;
		color: var(--accent);
	}
	.reply-text span {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--muted);
	}
	.recording {
		align-items: center;
	}
	.elapsed {
		flex: 1;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	.meter {
		flex: 0 0 4.5rem;
		height: 0.5rem;
		border-radius: 0.25rem;
		background: var(--line);
		overflow: hidden;
	}
	.meter > span {
		display: block;
		height: 100%;
		background: var(--accent);
		transition: width 0.1s linear;
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
	textarea {
		flex: 1;
		resize: none;
		max-height: 8rem;
		field-sizing: content;
	}
</style>
