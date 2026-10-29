<script lang="ts">
	// Campo de envio da conversa: texto, ou gravação de áudio quando o campo está vazio.
	import { MAX_TEXT_LENGTH, mentionedIn, mentionOf, withMentionLabels } from '@lerolero/core';
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
		editing,
		oncancelEdit,
		members,
		mentionLabel = (publicKey) => publicKey,
		error = $bindable('')
	}: {
		conversationId: string;
		/** sem envio (ex.: saí do grupo): o texto aparece no lugar do campo */
		closed?: string;
		/** a mensagem que o texto vai responder (RF-22); vale só para texto, áudio e foto seguem como mensagem nova */
		reply?: { id: string; name: string; preview: string };
		onclearReply?: () => void;
		/** a minha mensagem que estou editando (RF-24): enviar troca o texto dela */
		editing?: { id: string; text: string };
		oncancelEdit?: () => void;
		/** quem dá para mencionar com @ (RF-35): só nos grupos */
		members?: Array<{ publicKey: string; name: string }>;
		/** como cada menção aparece no campo ("@Ana") */
		mentionLabel?: (publicKey: string) => string;
		/** erros da conversa toda (enviar, copiar, apagar) aparecem aqui, acima do campo */
		error?: string;
	} = $props();

	let text = $state('');
	let input = $state<HTMLTextAreaElement>();

	// menções escolhidas na lista: no campo aparece "@Ana"; ao enviar vira a chave (nostr:npub1…)
	let mentions: Array<{ label: string; publicKey: string }> = [];
	let caret = $state(0);
	const trackCaret = () => (caret = input?.selectionStart ?? text.length);

	/** "@" seguido do começo de um nome, logo antes do cursor */
	const typing = $derived(members?.length ? text.slice(0, caret).match(/(?:^|\s)@([^\s@]*)$/u) : null);
	const fold = (v: string) => v.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
	const suggestions = $derived.by(() => {
		if (!typing || !members) return [];
		const query = fold(typing[1] ?? '');
		return members
			.filter((member) => fold(member.name.replace(/^~/, '')).split(/\s+/).some((word) => word.startsWith(query)))
			.slice(0, 5);
	});

	function pickMention(member: { publicKey: string; name: string }) {
		const start = caret - (typing?.[1]?.length ?? 0) - 1;
		const label = `@${member.name}`;
		text = `${text.slice(0, start)}${label} ${text.slice(caret)}`;
		mentions.push({ label, publicKey: member.publicKey });
		caret = start + label.length + 1;
		void Promise.resolve().then(() => {
			input?.focus();
			input?.setSelectionRange(caret, caret);
		});
	}

	/** O texto como vai: cada "@Nome" escolhido vira a chave da pessoa (o nome mais longo primeiro: "@Ana Paula" antes de "@Ana"). */
	function encode(value: string): string {
		return [...mentions]
			.sort((a, b) => b.label.length - a.label.length)
			.reduce((out, mention) => out.split(mention.label).join(mentionOf(mention.publicKey)), value);
	}

	// ao escolher "Editar", o campo recebe o texto da mensagem, com as menções como nomes
	let editingId: string | undefined;
	$effect(() => {
		if (editing?.id === editingId) return;
		editingId = editing?.id;
		if (!editing) return;
		mentions = mentionedIn(editing.text).map((publicKey) => ({ label: mentionLabel(publicKey), publicKey }));
		text = withMentionLabels(editing.text, mentionLabel);
		void Promise.resolve().then(() => {
			input?.focus();
			input?.setSelectionRange(text.length, text.length);
		});
	});

	function cancelEdit() {
		text = '';
		mentions = [];
		oncancelEdit?.();
	}

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
		const sent = encode(message);
		const used = mentions;
		mentions = [];
		try {
			if (editing) {
				await session.editMessage(conversationId, editing.id, sent);
				oncancelEdit?.();
			} else {
				await session.sendText(conversationId, sent, reply?.id);
				onclearReply?.();
			}
		} catch (err) {
			text = message;
			mentions = used;
			error = friendlyError(err);
		}
		input?.focus();
	}

	// no computador, Enter envia e Shift+Enter quebra a linha; no celular, Enter quebra a linha
	function onkeydown(event: KeyboardEvent) {
		// lista de menções aberta: Enter escolhe a primeira
		if (event.key === 'Enter' && !event.shiftKey && suggestions.length) {
			event.preventDefault();
			pickMention(suggestions[0]!);
			return;
		}
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
		{#if suggestions.length}
			<ul class="mentions" aria-label={m.mencao_lista()}>
				{#each suggestions as member (member.publicKey)}
					<li><button type="button" onclick={() => pickMention(member)}>@{member.name}</button></li>
				{/each}
			</ul>
		{/if}
		{#if editing}
			<div class="reply">
				<span class="reply-text">
					<strong>{m.edicao_titulo()}</strong>
				</span>
				<button type="button" class="round ghost" onclick={cancelEdit} aria-label={m.edicao_cancelar()}>
					<Icon name="x" />
				</button>
			</div>
		{:else if reply}
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
				oninput={trackCaret}
				onkeyup={trackCaret}
				onclick={trackCaret}
				rows="1"
				maxlength={MAX_TEXT_LENGTH}
				placeholder={m.envio_mensagem()}
				aria-label={m.envio_mensagem()}
			></textarea>
			{#if editing}
				<button class="round primary" type="submit" disabled={!text.trim()} aria-label={m.edicao_salvar()}><Icon name="check" /></button>
			{:else if text.trim()}
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
	.mentions {
		list-style: none;
		margin: 0 0 0.4rem;
		padding: 0.25rem;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--surface);
	}
	.mentions button {
		width: 100%;
		text-align: left;
		border: none;
		background: none;
		padding: 0.55rem 0.6rem;
	}
	.mentions button:hover,
	.mentions button:focus-visible {
		background: var(--bg);
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
