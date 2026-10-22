<script lang="ts">
	// PIN de 6 dígitos em bolinhas, como na tela de bloqueio do celular: teclado numérico, sem
	// preenchimento automático e, ao completar, chama oncomplete (entrar, pular para a confirmação…).
	import { tick } from 'svelte';

	let {
		value = $bindable(''),
		label,
		id,
		autofocus = false,
		disabled = false,
		error = false,
		shakes = 0,
		center = false,
		oncomplete
	}: {
		value?: string;
		label: string;
		id: string;
		autofocus?: boolean;
		disabled?: boolean;
		/** bolinhas em vermelho */
		error?: boolean;
		/** incrementa a cada erro, para a animação de tremer rodar de novo */
		shakes?: number;
		center?: boolean;
		oncomplete?: () => void;
	} = $props();

	const PIN_LENGTH = 6;
	// em atributo do Svelte, {6} seria lido como expressão; por isso a constante
	const PIN_PATTERN = '[0-9]{6}';

	let input = $state<HTMLInputElement>();

	export async function focus() {
		await tick();
		input?.focus();
	}

	function oninput() {
		value = value.replace(/\D/g, '').slice(0, PIN_LENGTH);
		if (value.length === PIN_LENGTH) oncomplete?.();
	}
</script>

<div class="field" class:center>
	<label for={id}>{label}</label>
	<!-- o campo de verdade fica invisível por cima das bolinhas: toque nelas abre o teclado numérico -->
	<div class="pin" class:error>
		{#key shakes}
			<div class="dots" class:shake={shakes > 0} aria-hidden="true">
				{#each { length: PIN_LENGTH }, i (i)}
					<span class="dot" class:filled={i < value.length}></span>
				{/each}
			</div>
		{/key}
		<!-- svelte-ignore a11y_autofocus -->
		<input
			bind:this={input}
			{id}
			type="password"
			inputmode="numeric"
			autocomplete="off"
			maxlength={PIN_LENGTH}
			pattern={PIN_PATTERN}
			required
			{autofocus}
			{disabled}
			bind:value
			{oninput}
		/>
	</div>
</div>

<style>
	.field {
		margin-bottom: 0.6rem;
	}
	.center {
		text-align: center;
	}
	.center label {
		margin: 0 0 1rem;
		color: var(--muted);
	}
	.pin {
		position: relative;
		width: fit-content;
		border-radius: 999px;
		transition: background 0.15s;
	}
	.center .pin {
		margin: 0 auto;
	}
	.pin:has(input:focus-visible),
	.field:not(.center) .pin:has(input:focus) {
		background: color-mix(in srgb, var(--accent) 10%, transparent);
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
		margin: 0;
		padding: 0;
		opacity: 0;
		font-size: 16px;
		caret-color: transparent;
		cursor: pointer;
	}
</style>
