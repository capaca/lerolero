<script lang="ts" module>
	// Um áudio por vez em todo o app: quando um começa, o que estava tocando pausa.
	let playing: HTMLAudioElement | undefined;

	function claimPlayback(audio: HTMLAudioElement) {
		if (playing && playing !== audio) playing.pause();
		playing = audio;
	}

	function releasePlayback(audio: HTMLAudioElement) {
		if (playing === audio) playing = undefined;
	}
</script>

<script lang="ts">
	// Player de áudio de mensagem (RF-40): baixa só ao tocar, velocidade 1x / 1,5x / 2x.
	import type { MessageMedia } from '@lerolero/core';
	import { onDestroy } from 'svelte';
	import Icon from './Icon.svelte';
	import { intlLocale } from '#lib/i18n.svelte.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { session } from '#lib/session.svelte.ts';

	let { media }: { media: MessageMedia } = $props();

	const SPEEDS = [1, 1.5, 2];
	let audio = $state<HTMLAudioElement>();
	let src = $state<string>();
	let phase = $state<'parado' | 'baixando' | 'tocando' | 'pausado' | 'erro'>('parado');
	let error = $state('');
	// silêncio do começo (media.start): o áudio começa dali, e quem quiser ainda volta ao início da barra
	const skip = $derived(media.start ?? 0);
	let current = $state(media.start ?? 0);
	// duração do arquivo quando carregado; antes disso, a que veio na mensagem
	let loadedDuration = $state<number>();
	const total = $derived(loadedDuration ?? media.duration ?? 0);
	let speedIndex = $state(0);

	const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

	async function toggle() {
		if (phase === 'tocando') return audio?.pause();
		if (!src) {
			phase = 'baixando';
			try {
				src = URL.createObjectURL(await session.openMedia(media));
			} catch {
				phase = 'erro';
				error = m.audio_erro_baixar();
				return;
			}
		}
		try {
			audio!.src = src;
			audio!.playbackRate = SPEEDS[speedIndex];
			if (skip && audio!.currentTime < skip) audio!.currentTime = skip;
			await audio!.play();
		} catch {
			phase = 'erro';
			error = m.audio_erro_formato();
		}
	}

	// o evento timeupdate do navegador vem só ~4 vezes por segundo e a barra anda aos
	// saltos; enquanto toca, a posição é lida a cada quadro da tela
	let frame = 0;
	function followPlayback() {
		cancelAnimationFrame(frame);
		const step = () => {
			if (!audio || audio.paused) return;
			current = audio.currentTime;
			frame = requestAnimationFrame(step);
		};
		frame = requestAnimationFrame(step);
	}

	function cycleSpeed() {
		speedIndex = (speedIndex + 1) % SPEEDS.length;
		if (audio) audio.playbackRate = SPEEDS[speedIndex];
	}

	function seek(event: Event) {
		// áudio gravado pelo navegador chega com duração infinita até acabar, mas dá para pular (`seekable`):
		// exigir duração finita travava a barra enquanto o áudio tocava
		if (audio && audio.seekable.length > 0) audio.currentTime = Number((event.target as HTMLInputElement).value);
	}

	onDestroy(() => {
		cancelAnimationFrame(frame);
		if (audio) {
			audio.pause();
			releasePlayback(audio);
		}
		if (src) URL.revokeObjectURL(src);
	});

	const progress = $derived(total ? Math.min(100, (current / total) * 100) : 0);
</script>

<div class="player">
	<button class="play" onclick={toggle} aria-label={phase === 'tocando' ? m.audio_pausar() : m.audio_tocar()} disabled={phase === 'baixando'}>
		<Icon name={phase === 'tocando' ? 'pause' : phase === 'baixando' ? 'loader' : 'play'} size={18} />
	</button>
	<input
		type="range"
		min="0"
		max={total || 1}
		step="any"
		value={current}
		oninput={seek}
		aria-label={m.audio_posicao()}
		disabled={!src}
		style:--progress="{progress}%"
	/>
	<span class="time">{fmt(phase === 'parado' ? Math.max(0, total - skip) : Math.max(0, current - skip))}</span>
	<button class="speed" onclick={cycleSpeed} aria-label={m.audio_velocidade()}>{new Intl.NumberFormat(intlLocale()).format(SPEEDS[speedIndex]!)}x</button>
	<audio
		bind:this={audio}
		onplay={() => (claimPlayback(audio!), (phase = 'tocando'), followPlayback())}
		onpause={() => (phase = 'pausado')}
		onended={() => {
			phase = 'pausado';
			current = skip;
			audio!.currentTime = skip; // ao ouvir de novo, também começa depois do silêncio
			releasePlayback(audio!);
		}}
		ontimeupdate={() => (current = audio!.currentTime)}
		onloadedmetadata={() => {
			if (Number.isFinite(audio!.duration)) loadedDuration = audio!.duration;
			if (skip && audio!.currentTime < skip) audio!.currentTime = skip;
		}}
		preload="none"
	></audio>
</div>
{#if phase === 'erro'}<p class="error small">{error}</p>{/if}

<style>
	.player {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 220px;
	}
	.play {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		padding: 0;
		flex-shrink: 0;
		display: grid;
		place-items: center;
		background: var(--accent);
		color: var(--accent-fg);
		border: none;
	}
	/* barra própria: trilho cinza, parte tocada na cor do app, bolinha que cresce ao tocar */
	input[type='range'] {
		flex: 1;
		height: 1.4rem;
		padding: 0;
		border: none;
		background: transparent;
		appearance: none;
		cursor: pointer;
	}
	input[type='range']::-webkit-slider-runnable-track {
		height: 4px;
		border-radius: 999px;
		background: linear-gradient(to right, var(--accent) var(--progress), var(--line) var(--progress));
	}
	input[type='range']::-moz-range-track {
		height: 4px;
		border-radius: 999px;
		background: linear-gradient(to right, var(--accent) var(--progress), var(--line) var(--progress));
	}
	input[type='range']::-webkit-slider-thumb {
		appearance: none;
		width: 12px;
		height: 12px;
		margin-top: -4px;
		border-radius: 50%;
		background: var(--accent);
		border: none;
		transition: transform 0.15s;
	}
	input[type='range']::-moz-range-thumb {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--accent);
		border: none;
	}
	input[type='range']:active::-webkit-slider-thumb {
		transform: scale(1.4);
	}
	input[type='range']:disabled {
		cursor: default;
	}
	.time {
		font-size: 0.8rem;
		color: var(--muted);
		min-width: 2.5rem;
	}
	.speed {
		padding: 0.15rem 0.45rem;
		font-size: 0.75rem;
		border-radius: 999px;
	}
	.small {
		font-size: 0.8rem;
		margin: 0.3rem 0 0;
	}
</style>
