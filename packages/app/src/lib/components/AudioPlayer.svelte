<script lang="ts">
	// Player de áudio de mensagem (RF-40): baixa só ao tocar, velocidade 1x / 1,5x / 2x.
	import type { MessageMedia } from '@lerolero/core';
	import { onDestroy } from 'svelte';
	import { session } from '#lib/session.svelte.ts';

	let { media }: { media: MessageMedia } = $props();

	const SPEEDS = [1, 1.5, 2];
	let audio = $state<HTMLAudioElement>();
	let src = $state<string>();
	let phase = $state<'parado' | 'baixando' | 'tocando' | 'pausado' | 'erro'>('parado');
	let error = $state('');
	let current = $state(0);
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
				error = 'Não foi possível baixar o áudio.';
				return;
			}
		}
		try {
			audio!.src = src;
			audio!.playbackRate = SPEEDS[speedIndex];
			await audio!.play();
		} catch {
			phase = 'erro';
			error = 'Este aparelho não toca este áudio. No iPhone, é preciso o iOS 18.4 ou mais novo.';
		}
	}

	function cycleSpeed() {
		speedIndex = (speedIndex + 1) % SPEEDS.length;
		if (audio) audio.playbackRate = SPEEDS[speedIndex];
	}

	function seek(event: Event) {
		if (audio && Number.isFinite(audio.duration)) audio.currentTime = Number((event.target as HTMLInputElement).value);
	}

	onDestroy(() => src && URL.revokeObjectURL(src));
</script>

<div class="player">
	<button class="play" onclick={toggle} aria-label={phase === 'tocando' ? 'Pausar' : 'Tocar'} disabled={phase === 'baixando'}>
		{phase === 'tocando' ? '❚❚' : phase === 'baixando' ? '…' : '▶'}
	</button>
	<input
		type="range"
		min="0"
		max={total || 1}
		step="0.1"
		value={current}
		oninput={seek}
		aria-label="Posição do áudio"
		disabled={!src}
	/>
	<span class="time">{fmt(phase === 'parado' ? total : current)}</span>
	<button class="speed" onclick={cycleSpeed} aria-label="Velocidade">{String(SPEEDS[speedIndex]).replace('.', ',')}x</button>
	<audio
		bind:this={audio}
		onplay={() => (phase = 'tocando')}
		onpause={() => (phase = 'pausado')}
		onended={() => ((phase = 'pausado'), (current = 0))}
		ontimeupdate={() => (current = audio!.currentTime)}
		onloadedmetadata={() => Number.isFinite(audio!.duration) && (loadedDuration = audio!.duration)}
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
		width: 2.4rem;
		height: 2.4rem;
		border-radius: 50%;
		padding: 0;
		flex-shrink: 0;
		background: var(--accent);
		color: var(--accent-fg);
		border: none;
	}
	input[type='range'] {
		flex: 1;
		padding: 0;
		border: none;
		background: transparent;
		accent-color: var(--accent);
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
