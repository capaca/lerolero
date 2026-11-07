<script lang="ts">
	// Criar um PIN: um por vez, no mesmo campo, como no bloqueio do celular (item 26). O foco não sai dele: completar
	// o primeiro pede a confirmação; se não bater, treme e volta ao começo, porque não dá para saber qual dos dois
	// saiu errado. Usado no cadastro, ao recuperar a conta e em "Esqueci o PIN".
	import PinInput from '#lib/components/PinInput.svelte';
	import { m } from '#lib/paraglide/messages.js';

	let {
		confirming = $bindable(false),
		label,
		confirmLabel,
		disabled = false,
		onconfirm
	}: {
		/** pedindo a confirmação: a tela troca o título */
		confirming?: boolean;
		label: string;
		confirmLabel: string;
		disabled?: boolean;
		/** os dois bateram; erros ficam com a tela, que pode chamar `reset` */
		onconfirm: (pin: string) => void;
	} = $props();

	let pin = $state('');
	let firstPin = '';
	let error = $state('');
	let shakes = $state(0);
	let input = $state<PinInput>();

	/** volta ao primeiro PIN, com a mensagem de erro se houver */
	export function reset(message = '') {
		pin = firstPin = '';
		confirming = false;
		error = message;
		void input?.focus();
	}

	function complete() {
		if (!confirming) {
			firstPin = pin;
			pin = '';
			error = '';
			confirming = true;
			return;
		}
		if (pin !== firstPin) {
			shakes++;
			navigator.vibrate?.(150);
			return reset(m.cadastro_pins_diferentes());
		}
		const chosen = pin;
		pin = firstPin = '';
		onconfirm(chosen);
	}
</script>

<PinInput
	bind:this={input}
	id="pin"
	label={confirming ? confirmLabel : label}
	bind:value={pin}
	autofocus
	center
	{disabled}
	error={!!error && !pin}
	{shakes}
	oncomplete={complete}
/>
{#if error}<p class="error center" role="alert">{error}</p>{/if}

<style>
	.center {
		text-align: center;
	}
</style>
