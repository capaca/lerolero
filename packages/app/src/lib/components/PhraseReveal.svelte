<script lang="ts">
	// Pede o PIN de novo mesmo com o app aberto: a frase é a coisa mais sensível da conta.
	// Usado em "ver minha frase" e em "Guarde sua frase".
	import PinInput from './PinInput.svelte';
	import { friendlyError } from '#lib/errors.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { session } from '#lib/session.svelte.ts';

	let { onrevealed }: { onrevealed: (words: string[]) => void } = $props();

	let pin = $state('');
	let error = $state('');
	let form = $state<HTMLFormElement>();
	let shakes = $state(0);

	async function reveal(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		try {
			onrevealed(await session.reveal(pin));
		} catch (err) {
			error = friendlyError(err);
			shakes++;
			navigator.vibrate?.(150);
		} finally {
			pin = '';
		}
	}
</script>

<form bind:this={form} onsubmit={reveal}>
	<PinInput
		id="pin"
		label={m.frase_pin_rotulo()}
		bind:value={pin}
		autofocus
		error={!!error && !pin}
		{shakes}
		oncomplete={() => form?.requestSubmit()}
	/>
	{#if error}<p class="error" role="alert">{error}</p>{/if}
	<div class="actions"><button class="primary" type="submit" disabled={pin.length !== 6}>{m.frase_ver()}</button></div>
</form>
