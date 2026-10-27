<script lang="ts" module>
	import { intlLocale } from '#lib/i18n.svelte.ts';

	/** Até duas iniciais: a do primeiro e a do último nome. */
	export function initials(name: string): string {
		const words = name.trim().split(/\s+/).filter(Boolean);
		if (words.length === 0) return '';
		const first = (w: string) => [...w][0]!.toLocaleUpperCase(intlLocale());
		return words.length === 1 ? first(words[0]!) : first(words[0]!) + first(words.at(-1)!);
	}

	/** Tom fixo por contato, tirado da chave pública (hex). */
	export function hue(publicKey: string): number {
		return parseInt(publicKey.slice(0, 6), 16) % 360 || 0;
	}
</script>

<script lang="ts">
	// Círculo com as iniciais do contato; sem nome conhecido, mostra o boneco.
	// A foto entra aqui quando houver o cartão de perfil (Q-P5).
	import Icon from './Icon.svelte';

	// grupo: ícone de pessoas, para não confundir com um contato que tenha as mesmas iniciais
	let { name, publicKey, size = 44, group = false }: { name?: string; publicKey: string; size?: number; group?: boolean } = $props();

	const letters = $derived(name && !group ? initials(name) : '');
</script>

<span class="avatar" style:--h={hue(publicKey)} style:--size="{size}px" aria-hidden="true">
	{#if letters}{letters}{:else}<Icon name={group ? 'users' : 'user'} size={Math.round(size * 0.5)} />{/if}
</span>

<style>
	.avatar {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: var(--size);
		height: var(--size);
		border-radius: 50%;
		background: hsl(var(--h) 38% 44%);
		color: #fff;
		font-weight: 700;
		font-size: calc(var(--size) * 0.38);
		line-height: 1;
		user-select: none;
	}
	@media (prefers-color-scheme: dark) {
		.avatar {
			background: hsl(var(--h) 30% 36%);
		}
	}
</style>
