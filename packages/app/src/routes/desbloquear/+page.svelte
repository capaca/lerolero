<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import PinInput from '#lib/components/PinInput.svelte';
	import { friendlyError } from '#lib/errors.ts';
	import { session } from '#lib/session.svelte.ts';

	let pin = $state('');
	let busy = $state(false);
	let error = $state('');
	// incrementa a cada erro, para a animação de tremer rodar de novo
	let shakes = $state(0);
	let pinInput = $state<PinInput>();

	$effect(() => {
		if (pin) error = '';
	});

	// entra sozinho ao completar os 6 números, como na tela de bloqueio do celular
	async function unlock(event?: SubmitEvent) {
		event?.preventDefault();
		if (busy || pin.length !== 6) return;
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
		await pinInput?.focus();
	}
</script>

<svelte:head><title>{m.app_nome()}</title></svelte:head>

<main class="lock">
	<div class="who">
		{#if session.identity}
			<Avatar name={session.identity.displayName} publicKey={session.identity.publicKey} size={76} />
		{/if}
		<h1>{session.identity ? m.desbloquear_ola_nome({ nome: session.identity.displayName }) : m.desbloquear_ola()}</h1>
	</div>

	<form onsubmit={unlock}>
		<PinInput
			bind:this={pinInput}
			id="pin"
			label={busy ? m.desbloquear_abrindo() : m.desbloquear_digite_pin()}
			bind:value={pin}
			autofocus
			center
			disabled={busy}
			error={!!error}
			{shakes}
			oncomplete={unlock}
		/>
		<p class="status" role="alert">
			{#if busy}<Icon name="loader" size={18} />{:else if error}{error}{/if}
		</p>
	</form>

	<a class="forgot" href={resolve('/esqueci-pin')}>{m.desbloquear_esqueci()}</a>
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
