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
	// Círculo com a foto do cartão de perfil (Q-P5, RF-02) ou as iniciais do contato; sem nome conhecido, o boneco.
	// A sessão decide de quem a foto pode aparecer (de pedido de mensagem não, T9).
	import { session } from '#lib/session.svelte.ts';
	import Icon from './Icon.svelte';

	// grupo: ícone de pessoas, para não confundir com um contato que tenha as mesmas iniciais
	// showPhoto={false}: só as iniciais (a tela do perfil, ao tirar a foto antes de salvar)
	let {
		name,
		publicKey,
		size = 44,
		group = false,
		showPhoto = true
	}: { name?: string; publicKey: string; size?: number; group?: boolean; showPhoto?: boolean } = $props();

	const letters = $derived(name && !group ? initials(name) : '');
	const photo = $derived(group || !showPhoto ? undefined : session.photos[publicKey]);
</script>

{#if photo}
	<img class="avatar" src={photo} alt="" style:--size="{size}px" aria-hidden="true" />
{:else}
	<span class="avatar" style:--h={hue(publicKey)} style:--size="{size}px" aria-hidden="true">
		{#if letters}{letters}{:else}<Icon name={group ? 'users' : 'user'} size={Math.round(size * 0.5)} />{/if}
	</span>
{/if}

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
	img.avatar {
		object-fit: cover;
		background: var(--surface);
	}
	@media (prefers-color-scheme: dark) {
		.avatar {
			background: hsl(var(--h) 30% 36%);
		}
	}
</style>
