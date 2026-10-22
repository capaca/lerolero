<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { highRiskOfDataLoss, isIOS } from '#lib/platform.ts';
	import { session } from '#lib/session.svelte.ts';

	const DAY = 24 * 60 * 60 * 1000;
	const SNOOZE_KEY = 'lembreteFraseAdiadoAte';

	let showPhraseReminder = $state(false);
	let showInstallWarning = $state(false);
	let highRisk = false;

	onMount(async () => {
		highRisk = highRiskOfDataLoss();
		showInstallWarning = highRisk;
		const snoozedUntil = (await session.getSetting<number>(SNOOZE_KEY)) ?? 0;
		showPhraseReminder = !session.identity?.phraseConfirmed && Date.now() > snoozedUntil;
	});

	// lembrete do RF-04: volta em 3 dias, ou em 1 se o risco de perder os dados for maior
	async function snooze() {
		await session.setSetting(SNOOZE_KEY, Date.now() + (highRisk ? 1 : 3) * DAY);
		showPhraseReminder = false;
	}
</script>

<svelte:head><title>Lero-lero</title></svelte:head>

<main>
	<header>
		<h1>Olá, {session.identity?.displayName}</h1>
		<a href={resolve('/ajustes')}>Ajustes</a>
	</header>

	{#if showInstallWarning}
		<div class="banner" role="status">
			<p><strong>Instale o Lero-lero na tela de início.</strong></p>
			<p>
				No iPhone, o Safari pode apagar os dados de sites que ficam alguns dias sem uso. Instalado, o app fica
				protegido. {#if isIOS()}Toque em <strong>Compartilhar</strong> e depois em
					<strong>Adicionar à Tela de Início</strong>.{/if}
			</p>
		</div>
	{/if}

	{#if showPhraseReminder}
		<div class="banner" role="status">
			<p><strong>Você ainda não conferiu sua frase de recuperação.</strong></p>
			<p>Sem ela, perder o celular ou esquecer o PIN significa perder sua conta.</p>
			<div class="actions">
				<a href={resolve('/ajustes/frase')}>Conferir agora</a>
				<button class="link" onclick={snooze}>Lembrar depois</button>
			</div>
		</div>
	{/if}

	<section class="card">
		<h2>Conversas</h2>
		<p class="hint">Em breve: adicionar contatos e conversar chega nas próximas etapas.</p>
	</section>
</main>

<style>
	header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}
</style>
