<script lang="ts">
	// Pede o PIN de novo mesmo com o app aberto: a frase é a coisa mais sensível da conta.
	// Usado em "ver minha frase", em "Guarde seu código" e em "Proteção da conta". Segue sozinho ao completar os 6
	// números, sem botão (item 26), como no cadastro.
	import PinInput from './PinInput.svelte';
	import { friendlyError } from '#lib/errors.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { session } from '#lib/session.svelte.ts';

	let { onrevealed, label = m.frase_pin_rotulo() }: { onrevealed: (words: string[]) => void; label?: string } = $props();

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
		{label}
		bind:value={pin}
		autofocus
		center
		error={!!error && !pin}
		{shakes}
		oncomplete={() => form?.requestSubmit()}
	/>
	{#if error}<p class="error center" role="alert">{error}</p>{/if}
</form>

<style>
	form {
		margin-top: 1.5rem;
	}
	.center {
		text-align: center;
	}
</style>
