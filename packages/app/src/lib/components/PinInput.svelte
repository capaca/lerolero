<script lang="ts">
	// Campo de PIN de 6 dígitos: teclado numérico no celular e sem preenchimento automático.
	let {
		value = $bindable(''),
		label,
		id,
		autofocus = false
	}: { value?: string; label: string; id: string; autofocus?: boolean } = $props();

	// em atributo do Svelte, {6} seria lido como expressão; por isso a constante
	const PIN_PATTERN = '[0-9]{6}';
</script>

<label for={id}>{label}</label>
<!-- svelte-ignore a11y_autofocus -->
<input
	{id}
	type="password"
	inputmode="numeric"
	autocomplete="off"
	maxlength="6"
	pattern={PIN_PATTERN}
	required
	{autofocus}
	bind:value
	oninput={() => (value = value.replace(/\D/g, '').slice(0, 6))}
	class="pin"
/>

<style>
	.pin {
		font-size: 1.6rem;
		letter-spacing: 0.6em;
		text-align: center;
		max-width: 16rem;
	}
</style>
