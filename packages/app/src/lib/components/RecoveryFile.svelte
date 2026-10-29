<script lang="ts">
	// Guardar o código de recuperação sem copiar à mão (RF-09 a, ADR-0009 D2): um arquivo .txt autoexplicativo, salvo
	// no aparelho ou mandado pelo menu de compartilhar, ou um cartão impresso. O app não sabe para onde o arquivo foi;
	// por isso a conta só fica protegida quando a pessoa confirma "Guardei o arquivo" (decidido em 2026-10-29).
	// Usado em "Guarde seu código" e em "Proteção da conta".
	import { resolve } from '$app/paths';
	import { numberedWords, recoveryFragment } from '@lerolero/core';
	import QrCode from './QrCode.svelte';
	import Rich from './Rich.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { session } from '#lib/session.svelte.ts';

	let { words, onsaved, onwrite }: { words: string[]; onsaved: () => void; onwrite?: () => void } = $props();

	const address = new URL(resolve('/'), location.origin).href;
	// as palavras vão no fragmento (#), que o navegador não manda ao servidor (T21)
	const link = $derived(new URL(resolve('/restaurar'), location.origin).href + recoveryFragment(words));
	const name = $derived(session.identity?.displayName ?? '');
	let ready = $state(false);
	let shareError = $state('');
	let sharing = $state(false);

	const file = () =>
		new File([m.arquivo_texto({ nome: name, link, endereco: address, palavras: numberedWords(words) })], m.arquivo_nome(), {
			type: 'text/plain'
		});
	// só mostra o compartilhar onde ele aceita arquivos (no computador, em geral não)
	const canShareFiles = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file()] });

	// o download sai no próprio toque, sem nada esperado antes: depois de um await o Chrome do Android o bloqueia
	// sem aviso, e nada acontecia (bug visto no Motorola, 2026-10-29)
	function download() {
		const url = URL.createObjectURL(file());
		const a = Object.assign(document.createElement('a'), { href: url, download: m.arquivo_nome() });
		document.body.append(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(url), 60_000);
		ready = true;
	}

	async function share() {
		// um compartilhar ainda aberto faz o próximo falhar com InvalidStateError; no Android o menu às vezes nem
		// aparece e a promessa não termina (visto no Motorola pelo http do celular.sh, 2026-10-29)
		if (sharing) return;
		sharing = true;
		shareError = '';
		try {
			await navigator.share({ files: [file()], title: m.arquivo_titulo() });
			ready = true;
		} catch (err) {
			// cancelado no menu: nada foi guardado, e não é erro
			if ((err as Error).name !== 'AbortError') shareError = (err as Error).name || String(err);
		} finally {
			sharing = false;
		}
	}

	function print() {
		window.print();
		ready = true;
	}
</script>

<p><Rich text={m.arquivo_dica()} /></p>
<div class="actions stack">
	<button class={ready ? '' : 'primary'} onclick={download}>{m.arquivo_salvar()}</button>
	{#if canShareFiles}<button disabled={sharing} onclick={share}>{m.arquivo_compartilhar()}</button>{/if}
	<button onclick={print}>{m.arquivo_imprimir()}</button>
	{#if onwrite}<button class="link" onclick={onwrite}>{m.arquivo_anotar()}</button>{/if}
</div>
{#if shareError}<p class="error" role="alert">{m.arquivo_compartilhar_erro({ erro: shareError })}</p>{/if}
{#if ready}
	<div class="done" role="status">
		<p>{m.arquivo_confirme()}</p>
		<button class="primary" onclick={onsaved}>{m.arquivo_guardei()}</button>
	</div>
{/if}

<!-- o cartão só existe na impressão -->
<section class="print-card" aria-hidden="true">
	<h1>{m.cartao_titulo({ nome: name })}</h1>
	<p><Rich text={m.cartao_aviso()} /></p>
	<ol>
		{#each words as word, i (i)}
			<li><span>{i + 1}.</span> {word}</li>
		{/each}
	</ol>
	<QrCode text={link} label={m.cartao_qr()} />
	<p>{m.cartao_como({ endereco: address })}</p>
</section>

<style>
	.done {
		margin-top: 1rem;
	}
	.print-card {
		display: none;
	}
	@media print {
		/* só o cartão sai no papel */
		:global(body *) {
			visibility: hidden;
		}
		.print-card,
		.print-card :global(*) {
			visibility: visible;
		}
		.print-card {
			display: block;
			position: absolute;
			inset: 0 auto auto 0;
			width: 100%;
			max-width: 16cm;
			padding: 1cm;
			border: 2px dashed #000;
			color: #000;
			background: #fff;
		}
		.print-card h1 {
			font-size: 14pt;
		}
		.print-card ol {
			list-style: none;
			padding: 0;
			display: grid;
			grid-template-columns: repeat(3, 1fr);
			gap: 0.3cm;
			font: 13pt ui-monospace, monospace;
		}
		.print-card :global(.qr) {
			max-width: 4cm;
			margin: 0.5cm 0;
		}
	}
</style>
