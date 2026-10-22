<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { tick } from 'svelte';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { friendlyError, session } from '#lib/session.svelte.ts';

	const PIN_LENGTH = 6;

	let pin = $state('');
	let busy = $state(false);
	let error = $state('');
	// incrementa a cada erro, para a animação de tremer rodar de novo
	let shakes = $state(0);
	let input = $state<HTMLInputElement>();

	// entra sozinho ao completar os 6 números, como na tela de bloqueio do celular
	async function oninput() {
		pin = pin.replace(/\D/g, '').slice(0, PIN_LENGTH);
		if (pin) error = '';
		if (pin.length === PIN_LENGTH) await unlock();
	}

	async function unlock(event?: SubmitEvent) {
		event?.preventDefault();
		if (busy || pin.length !== PIN_LENGTH) return;
		busy = true;
		error = '';
		try {
			await session.unlock(pin);
			await goto(resolve('/'));
		} catch (err) {
			error = friendlyError(err);
			pin = '';
			shakes++;
			navigator.vibrate?.(150);
		} finally {
			busy = false;
		}
		await tick();
		input?.focus();
	}
</script>

<svelte:head><title>Lero-lero</title></svelte:head>

<main class="lock">
	<div class="who">
		{#if session.identity}
			<Avatar name={session.identity.displayName} publicKey={session.identity.publicKey} size={76} />
		{/if}
		<h1>Olá{session.identity ? `, ${session.identity.displayName}` : ''}</h1>
	</div>

	<form onsubmit={unlock}>
		<label for="pin">{busy ? 'Abrindo…' : 'Digite seu PIN'}</label>
		<!-- o campo de verdade fica invisível por cima das bolinhas: toque nelas abre o teclado numérico -->
		<div class="pin" class:error={!!error}>
			{#key shakes}
				<div class="dots" class:shake={shakes > 0} aria-hidden="true">
					{#each { length: PIN_LENGTH }, i (i)}
						<span class="dot" class:filled={i < pin.length}></span>
					{/each}
				</div>
			{/key}
			<!-- svelte-ignore a11y_autofocus -->
			<input
				bind:this={input}
				id="pin"
				type="password"
				inputmode="numeric"
				autocomplete="off"
				maxlength={PIN_LENGTH}
				required
				autofocus
				disabled={busy}
				bind:value={pin}
				{oninput}
			/>
		</div>
		<p class="status" role="alert">
			{#if busy}<Icon name="loader" size={18} />{:else if error}{error}{/if}
		</p>
	</form>

	<a class="forgot" href={resolve('/esqueci-pin')}>Esqueci o PIN</a>
</main>

<style>
	.lock {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding-bottom: calc(16px + env(safe-area-inset-bottom));
	}
	.who {
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	h1 {
		margin: 1rem 0 2rem;
	}
	label {
		margin: 0 0 1rem;
		font-weight: 500;
		color: var(--muted);
	}
	.pin {
		position: relative;
		width: fit-content;
		margin: 0 auto;
	}
	.dots {
		display: flex;
		gap: 1.1rem;
		padding: 0.6rem 0.8rem;
	}
	.dot {
		width: 1rem;
		height: 1rem;
		border-radius: 50%;
		border: 2px solid var(--muted);
		transition:
			background 0.12s,
			border-color 0.12s,
			transform 0.12s;
	}
	.dot.filled {
		background: var(--accent);
		border-color: var(--accent);
		transform: scale(1.1);
	}
	.error .dot {
		border-color: var(--danger);
	}
	.shake {
		animation: shake 0.4s;
	}
	@keyframes shake {
		20%,
		60% {
			transform: translateX(-8px);
		}
		40%,
		80% {
			transform: translateX(8px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.shake {
			animation: none;
		}
	}
	/* invisível, mas tocável e com foco: o teclado do celular e o leitor de tela usam este campo */
	input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		font-size: 16px;
		caret-color: transparent;
		cursor: pointer;
	}
	.pin {
		border-radius: 999px;
		transition: background 0.15s;
	}
	.pin:has(input:focus-visible) {
		background: color-mix(in srgb, var(--accent) 10%, transparent);
	}
	.status {
		min-height: 3rem;
		margin: 0.8rem 0 0;
		max-width: 20rem;
		display: flex;
		justify-content: center;
		color: var(--danger);
	}
	.status :global(svg) {
		color: var(--muted);
	}
	.forgot {
		margin-top: 2.5rem;
		padding: 0.6rem;
	}
</style>
