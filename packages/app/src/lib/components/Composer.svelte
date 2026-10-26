<script lang="ts">
	// Campo de envio da conversa: texto, ou gravação de áudio quando o campo está vazio.
	import { MAX_TEXT_LENGTH } from '@lerolero/core';
	import { onDestroy } from 'svelte';
	import Icon from './Icon.svelte';
	import { MAX_SECONDS, startRecording, type Recording } from '#lib/recorder.ts';
	import { friendlyError } from '#lib/errors.ts';
	import { session } from '#lib/session.svelte.ts';

	let {
		conversationId,
		closed,
		error = $bindable('')
	}: {
		conversationId: string;
		/** sem envio (ex.: saí do grupo): o texto aparece no lugar do campo */
		closed?: string;
		/** erros da conversa toda (enviar, copiar, apagar) aparecem aqui, acima do campo */
		error?: string;
	} = $props();

	let text = $state('');
	let input = $state<HTMLTextAreaElement>();

	// gravação de áudio: um toque começa, outro envia (RF-40)
	let recording = $state<Recording>();
	let elapsed = $state(0);
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
		const { file, duration, start } = await current.stop();
		if (duration < 1) return; // toque sem querer
		try {
			await session.sendAudio(conversationId, file, duration, start);
		} catch (err) {
			error = friendlyError(err);
		}
	}

	onDestroy(cancelAudio);

	const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

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
</script>

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
	textarea {
		flex: 1;
		resize: none;
		max-height: 8rem;
		field-sizing: content;
	}
</style>
