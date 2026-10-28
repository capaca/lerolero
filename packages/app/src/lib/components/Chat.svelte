<script lang="ts">
	// Conversa (1:1 ou grupo): mensagens, avisos de grupo, menu da mensagem e campo de envio.
	// O topo e os avisos de cima ficam com a tela que usa o componente.
	import { contactName, deliveryOf, forwardOf, type MessageRecord, type ReactionRecord } from '@lerolero/core';
	import { onDestroy, tick, type Snippet } from 'svelte';
	import Composer from './Composer.svelte';
	import Icon from './Icon.svelte';
	import MessageBubble from './MessageBubble.svelte';
	import ForwardSheet from './ForwardSheet.svelte';
	import MessageMenu from './MessageMenu.svelte';
	import Sheet from './Sheet.svelte';
	import { dayKey, formatDay } from '#lib/format.ts';
	import { friendlyError } from '#lib/errors.ts';
	import { memberName, noticeText, type NameOf } from '#lib/notices.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { session } from '#lib/session.svelte.ts';

	let {
		conversationId,
		header,
		banner,
		nameOf,
		linkMode,
		closed
	}: {
		conversationId: string;
		header: Snippet;
		banner?: Snippet;
		/** só nos grupos: quem é cada membro, para o nome nos balões e nos avisos */
		nameOf?: NameOf;
		/** o que fazer com os endereços nas mensagens de cada pessoa (T18); o padrão é deixar como texto */
		linkMode?: (publicKey: string) => 'aberto' | 'aviso' | 'texto';
		/** sem envio (ex.: saí do grupo): o texto aparece no lugar do campo */
		closed?: string;
	} = $props();

	// Abre com as últimas mensagens; as anteriores vêm sob demanda. As mensagens ficam
	// em blocos com content-visibility: o modo que rolou melhor no celular (prototipos/medicao).
	const PAGE_SIZE = 200;
	const BLOCK_SIZE = 50;

	const me = session.identity?.publicKey;

	let loaded = $state(false);
	let messages = $state.raw<MessageRecord[]>([]);
	let hasOlder = $state(false);
	let extraPages = 0;
	let firstLoad = true;
	let error = $state('');
	let scroller = $state<HTMLDivElement>();
	// quem recebe o que eu escrevo (os estados de entrega são os do mais atrasado), as reações por mensagem e as
	// mensagens citadas que não estão na página carregada
	let recipients = $state.raw<string[]>([]);
	let reactions = $state.raw(new Map<string, ReactionRecord[]>());
	let quoted = $state.raw(new Map<string, MessageRecord>());
	let otherName = $state('');

	// menu da mensagem: toque longo (celular) ou botão direito (computador)
	let menuFor = $state.raw<MessageRecord>();

	function openMenu(message: MessageRecord) {
		if (message.deleted || message.notice) return;
		menuFor = message;
		// vibração curta confirma o toque longo (no iPhone o navegador não vibra)
		navigator.vibrate?.(15);
	}

	// responder (RF-22): o campo mostra a citação; vale para o próximo texto enviado
	let replying = $state.raw<MessageRecord>();

	const nameFor = (sender: string) => (sender === me ? m.citada_voce() : nameOf ? memberName(nameOf(sender)) : otherName);
	function previewOf(message: MessageRecord): string {
		if (message.deleted) return m.citada_apagada();
		if (message.media) return message.media.type.startsWith('audio/') ? m.previa_audio() : message.media.type.startsWith('image/') ? m.previa_foto() : '';
		return message.text.replace(/\s+/g, ' ').trim().slice(0, 120);
	}

	function startReply() {
		replying = menuFor;
		menuFor = undefined;
	}

	async function react(message: MessageRecord, emoji: string) {
		menuFor = undefined;
		try {
			await session.react(conversationId, message.id, emoji);
		} catch (err) {
			error = friendlyError(err);
		}
	}

	/** Reações de uma mensagem somadas por emoji, na ordem em que apareceram. */
	function chipsOf(messageId: string) {
		const chips: Array<{ emoji: string; count: number; mine: boolean }> = [];
		for (const reaction of reactions.get(messageId) ?? []) {
			const chip = chips.find((c) => c.emoji === reaction.emoji);
			if (chip) {
				chip.count++;
				chip.mine ||= reaction.sender === me;
			} else chips.push({ emoji: reaction.emoji, count: 1, mine: reaction.sender === me });
		}
		return chips;
	}
	const myReactionTo = (messageId: string) => reactions.get(messageId)?.find((r) => r.sender === me)?.emoji;

	// a citação leva à mensagem original, se ela está na tela
	function goToQuoted(id: string) {
		const el = scroller?.querySelector<HTMLElement>(`[data-id="${id}"]`);
		el?.scrollIntoView({ block: 'center' });
	}

	// endereço de quem não é contato: confirma antes de abrir, mostrando o domínio inteiro
	let pendingLink = $state.raw<{ href: string; host: string }>();
	function openLink() {
		if (pendingLink) window.open(pendingLink.href, '_blank', 'noopener,noreferrer');
		pendingLink = undefined;
	}

	let copied = $state(false);
	let copiedTimer: ReturnType<typeof setTimeout> | undefined;
	async function copyMessage() {
		const message = menuFor;
		menuFor = undefined;
		if (!message) return;
		try {
			await navigator.clipboard.writeText(message.text);
			copied = true;
			clearTimeout(copiedTimer);
			copiedTimer = setTimeout(() => (copied = false), 2000);
		} catch {
			error = m.conversa_erro_copiar();
		}
	}
	onDestroy(() => clearTimeout(copiedTimer));


	// encaminhar: o menu fecha e abre a escolha do destino; ao escolher, vai para a conversa e a tela segue nela
	let forwarding = $state.raw<MessageRecord>();
	async function forwardTo(destination: string) {
		const message = forwarding;
		forwarding = undefined;
		if (!message) return;
		try {
			await session.forwardMessage(message.id, destination);
			forwarded = true;
			clearTimeout(forwardedTimer);
			forwardedTimer = setTimeout(() => (forwarded = false), 2000);
		} catch (err) {
			error = friendlyError(err);
		}
	}
	let forwarded = $state(false);
	let forwardedTimer: ReturnType<typeof setTimeout> | undefined;
	onDestroy(() => clearTimeout(forwardedTimer));

	async function deleteMessage(forEveryone: boolean) {
		const message = menuFor;
		menuFor = undefined;
		if (!message) return;
		try {
			if (forEveryone) await session.deleteForEveryone(conversationId, message.id);
			else await session.deleteForMe(message.id);
		} catch (err) {
			error = friendlyError(err);
		}
	}

	// first/last: começo e fim de uma sequência de balões da mesma pessoa no mesmo dia, sem aviso nem
	// a linha "Mensagens novas" no meio.
	// Só o último ganha a pontinha; nos grupos, o nome vai no primeiro.
	type Item =
		| { type: 'dia'; key: number; label: string }
		| { type: 'novas' }
		| { type: 'msg'; message: MessageRecord; first: boolean; last: boolean; day: string };
	const blocks = $derived.by(() => {
		const items: Item[] = [];
		let lastDay: number | undefined;
		let dayLabel = '';
		let previous: Extract<Item, { type: 'msg' }> | undefined;
		for (const message of messages) {
			const day = dayKey(message.createdAt);
			if (day !== lastDay) {
				dayLabel = formatDay(message.createdAt);
				items.push({ type: 'dia', key: day, label: dayLabel });
			}
			const first =
				day !== lastDay ||
				!previous ||
				!!previous.message.notice ||
				!!message.notice ||
				previous.message.sender !== message.sender ||
				message.id === newFrom;
			if (first && previous) previous.last = true;
			lastDay = day;
			if (message.id === newFrom) items.push({ type: 'novas' });
			previous = { type: 'msg', message, first, last: false, day: dayLabel };
			items.push(previous);
		}
		if (previous) previous.last = true;
		const out: Item[][] = [];
		for (let i = 0; i < items.length; i += BLOCK_SIZE) out.push(items.slice(i, i + BLOCK_SIZE));
		return out;
	});

	// "Mensagens novas": a linha fica antes da primeira não lida ao abrir, ou da primeira que
	// chegou enquanto a pessoa lia lá em cima; o botão de ir para o fim conta as que chegaram.
	let newFrom = $state<string>();
	let pending = $state(0);
	let farFromEnd = $state(false);

	const nearBottom = () => !scroller || scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 150;

	// O teclado encolhe a área das mensagens: quem estava no fim continua vendo as últimas.
	let atEnd = true;
	// altura da área quando o ResizeObserver a viu pela última vez
	let seenHeight = 0;
	function onscroll() {
		const distance = scroller ? scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight : 0;
		// a rolagem é entregue antes do ResizeObserver: se a área acabou de encolher, a distância já é a
		// da área menor e "esqueceria" que a pessoa estava no fim; quem decide é o observer, logo depois
		if (scroller && scroller.clientHeight === seenHeight) atEnd = distance < 8;
		farFromEnd = distance > 300;
		if (atEnd) pending = 0;
		dayRetries = 0;
		if (!dayFrame) dayFrame = requestAnimationFrame(updateFloatingDay);
	}

	// Data presa no topo ao rolar, com o dia da mensagem lá em cima; some quando a rolagem para.
	// Não dá para usar position: sticky: um dia atravessa vários blocos e ficaria preso a cada um.
	let floatingDay = $state('');
	let showDay = $state(false);
	let dayFrame = 0;
	let dayRetries = 0;
	let hideDay: ReturnType<typeof setTimeout> | undefined;
	function updateFloatingDay() {
		dayFrame = 0;
		clearTimeout(hideDay);
		// no fim da conversa (inclusive quando o app rola sozinho ao abrir) não precisa
		if (!scroller || atEnd) return void (showDay = false);
		const box = scroller.getBoundingClientRect();
		let found = false;
		for (let y = box.top + 8; y < box.top + 80; y += 6) {
			const el = document.elementFromPoint(box.left + box.width / 2, y)?.closest<HTMLElement>('[data-day]');
			if (el) {
				floatingDay = el.dataset.day!;
				showDay = true;
				found = true;
				break;
			}
		}
		// o bloco que acabou de entrar na tela pode ainda não estar desenhado (content-visibility): tenta nos
		// próximos quadros em vez de ficar sem a data até a próxima rolagem
		if (!found && dayRetries++ < 10) dayFrame = requestAnimationFrame(updateFloatingDay);
		hideDay = setTimeout(() => (showDay = false), 1500);
	}
	// Numa rolagem longa, o bloco que entra na tela só é desenhado depois e cresce do tamanho
	// estimado para o real, mudando o que fica no topo sem novo evento de rolagem.
	$effect(() => {
		if (!scroller) return;
		const el = scroller;
		const recheck = () => showDay && !dayFrame && (dayFrame = requestAnimationFrame(updateFloatingDay));
		// o evento não sobe pela árvore: só a captura o pega no contêiner
		el.addEventListener('contentvisibilityautostatechange', recheck, true);
		return () => el.removeEventListener('contentvisibilityautostatechange', recheck, true);
	});
	onDestroy(() => (cancelAnimationFrame(dayFrame), clearTimeout(hideDay)));
	$effect(() => {
		if (!scroller) return;
		const el = scroller;
		const observer = new ResizeObserver(() => {
			seenHeight = el.clientHeight;
			if (atEnd) el.scrollTop = el.scrollHeight;
		});
		observer.observe(el);
		return () => observer.disconnect();
	});

	async function load() {
		const limit = PAGE_SIZE * (1 + extraPages);
		const [list, conversation, reactionList] = await Promise.all([
			session.getMessages(conversationId, limit + 1),
			session.getConversation(conversationId),
			session.getReactions(conversationId)
		]);
		const byMessage = new Map<string, ReactionRecord[]>();
		for (const reaction of reactionList.sort((a, b) => a.createdAt - b.createdAt)) {
			byMessage.set(reaction.messageId, [...(byMessage.get(reaction.messageId) ?? []), reaction]);
		}
		reactions = byMessage;
		recipients = conversation?.members ?? [];
		// citações de mensagens mais antigas que a página
		const here = new Set(list.map((x) => x.id));
		const found = new Map<string, MessageRecord>();
		for (const id of new Set(list.flatMap((x) => (x.replyTo && !here.has(x.replyTo) ? [x.replyTo] : [])))) {
			const original = await session.getMessage(id);
			if (original) found.set(id, original);
		}
		quoted = found;
		const stick = firstLoad || nearBottom() || list.at(-1)?.sender === me;
		const fromOthers = (m: MessageRecord) => m.sender !== me && !m.notice;
		if (firstLoad) {
			const unread = list.filter(fromOthers).slice(-(conversation?.unread ?? 0));
			if (conversation?.unread) newFrom = unread[0]?.id;
		} else if (!stick) {
			// só as que chegaram depois da última na tela (não as antigas de "carregar anteriores")
			const known = new Set(messages.map((m) => m.id));
			const after = messages.at(-1)?.createdAt ?? 0;
			const arrived = list.filter((m) => fromOthers(m) && !known.has(m.id) && m.createdAt >= after);
			if (arrived.length && !pending) newFrom = arrived[0].id;
			pending += arrived.length;
		}
		hasOlder = list.length > limit;
		messages = hasOlder ? list.slice(1) : list;
		loaded = true;
		await tick();
		const divider = scroller?.querySelector('.new-line');
		if (firstLoad && divider && scroller) {
			// abre na primeira não lida; se forem poucas, isso já é o fim
			scroller.scrollTop += divider.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 8;
			onscroll();
		} else if (stick && scroller) {
			scroller.scrollTop = scroller.scrollHeight;
			pending = 0;
		}
		firstLoad = false;
		if (conversation?.unread) await session.markRead(conversationId);
		acknowledgeVisible();
	}

	// "Lida" (RF-50): o que está na tela e veio dos outros; só com o app à vista, não com a aba escondida
	function acknowledgeVisible() {
		if (document.visibilityState !== 'visible') return;
		const ids = messages.filter((x) => x.sender !== me && !x.notice && !x.deleted && x.ack !== 'lida').map((x) => x.id);
		if (ids.length) void session.acknowledgeRead(ids);
	}
	$effect(() => {
		document.addEventListener('visibilitychange', acknowledgeVisible);
		return () => document.removeEventListener('visibilitychange', acknowledgeVisible);
	});
	// nome do outro lado, para a citação de uma conversa 1:1
	$effect(() => {
		if (!conversationId.startsWith('direta:')) return;
		void session.getContact(conversationId.slice('direta:'.length)).then((contact) => (otherName = contact ? contactName(contact) : ''));
	});

	// Pulo direto, sem rolagem suave: os blocos desenhados no caminho crescem do tamanho estimado
	// para o real e o fim se afasta; por isso confere de novo nos quadros seguintes.
	function goToEnd(frames = 3) {
		if (!scroller) return;
		scroller.scrollTop = scroller.scrollHeight;
		pending = 0;
		if (frames > 0) requestAnimationFrame(() => goToEnd(frames - 1));
	}

	// recarrega quando muda a conversa ou chega/sai qualquer mensagem (session.version)
	$effect(() => {
		void session.version;
		session.openConversationId = conversationId;
		void load();
	});
	// conecta já aos relays de quem recebe, para a primeira mensagem não esperar a conexão
	$effect(() => {
		let release: (() => void) | undefined;
		let gone = false;
		void session.prepareConversation(conversationId).then((r) => (gone ? r() : (release = r)));
		return () => {
			gone = true;
			release?.();
		};
	});
	onDestroy(() => (session.openConversationId = undefined));

	async function loadOlder() {
		const before = scroller!.scrollHeight;
		extraPages++;
		await load();
		// mantém na tela a mensagem que a pessoa estava lendo
		scroller!.scrollTop += scroller!.scrollHeight - before;
	}

</script>

<div class="chat">
	{@render header()}
	{@render banner?.()}

	<div class="area">
		<p class="floating-day" class:visible={showDay} aria-hidden="true">{floatingDay}</p>
		<div class="messages" bind:this={scroller} {onscroll} aria-live="polite">
			{#if hasOlder}
				<button class="link older" onclick={loadOlder}>{m.conversa_carregar_anteriores()}</button>
			{/if}
			{#if messages.length === 0 && loaded}
				<p class="hint empty">{m.conversa_vazia()}</p>
			{/if}
			{#each blocks as block, b (b)}
				<div class="block" style:--block-estimate="{block.length * 56}px">
					{#each block as item (item.type === 'msg' ? item.message.id : item.type === 'dia' ? `d${item.key}` : 'novas')}
						{#if item.type === 'novas'}
							<p class="new-line"><span>{m.conversa_novas()}</span></p>
						{:else if item.type === 'dia'}
							<p class="day" data-day={item.label}>{item.label}</p>
						{:else if item.message.notice}
							<p class="notice-line">{noticeText(item.message.notice, item.message.sender, nameOf ?? (() => undefined))}</p>
						{:else}
							{@const msg = item.message}
							<MessageBubble
								message={msg}
								mine={msg.sender === me}
								first={item.first}
								last={item.last}
								day={item.day}
								senderName={nameOf && item.first && msg.sender !== me ? memberName(nameOf(msg.sender)) : undefined}
								links={msg.sender === me ? 'aberto' : (linkMode?.(msg.sender) ?? 'texto')}
								delivery={msg.sender === me ? deliveryOf(msg, recipients) : undefined}
								quote={msg.replyTo
									? (() => {
											const original = messages.find((x) => x.id === msg.replyTo) ?? quoted.get(msg.replyTo);
											return { name: original ? nameFor(original.sender) : '', message: original };
										})()
									: undefined}
								reactions={chipsOf(msg.id)}
								onquote={() => goToQuoted(msg.replyTo!)}
								onreact={(emoji) => react(msg, emoji)}
								onlink={(href, host) => (pendingLink = { href, host })}
								onmenu={() => openMenu(msg)}
							/>
						{/if}
					{/each}
				</div>
			{/each}
		</div>
		{#if forwarded}
			<p class="copied" role="status">{m.conversa_encaminhada()}</p>
		{:else if copied}
			<p class="copied" role="status">{m.conversa_copiada()}</p>
		{/if}
		{#if farFromEnd || pending}
			<button class="round jump" onclick={() => goToEnd()} aria-label={pending ? m.conversa_ir_fim_novas({ count: pending }) : m.conversa_ir_fim()}>
				<Icon name="chevron-down" />
				{#if pending}<span class="badge" aria-hidden="true">{pending > 99 ? '99+' : pending}</span>{/if}
			</button>
		{/if}
	</div>

	{#if menuFor}
		<MessageMenu
			mine={menuFor.sender === me}
			group={!!nameOf}
			onclose={() => (menuFor = undefined)}
			myReaction={myReactionTo(menuFor.id)}
			onreact={menuFor.upload ? undefined : (emoji) => react(menuFor!, emoji)}
			onreply={menuFor.upload || closed ? undefined : startReply}
			oncopy={menuFor.media ? undefined : copyMessage}
			onforward={forwardOf(menuFor)
				? () => {
						forwarding = menuFor;
						menuFor = undefined;
					}
				: undefined}
			ondeleteForMe={() => deleteMessage(false)}
			ondeleteForEveryone={() => deleteMessage(true)}
		/>
	{/if}

	{#if forwarding}
		<ForwardSheet onclose={() => (forwarding = undefined)} onpick={forwardTo} />
	{/if}

	{#if pendingLink}
		<Sheet label={m.conversa_link_titulo()} onclose={() => (pendingLink = undefined)}>
			<p><strong>{m.conversa_link_pergunta({ host: pendingLink.host })}</strong></p>
			<p class="hint">{m.conversa_link_dica()}</p>
			<div class="actions">
				<button onclick={() => (pendingLink = undefined)}>{m.comum_cancelar()}</button>
				<button class="primary" onclick={openLink}>{m.conversa_link_abrir()}</button>
			</div>
		</Sheet>
	{/if}

	<Composer
		{conversationId}
		{closed}
		reply={replying ? { id: replying.id, name: nameFor(replying.sender), preview: previewOf(replying) } : undefined}
		onclearReply={() => (replying = undefined)}
		bind:error
	/>
</div>

<style>
	.chat {
		height: calc(100dvh - var(--offline-bar, 0px));
		display: flex;
		flex-direction: column;
		max-width: 720px;
		margin: 0 auto;
	}
	.notice-line {
		text-align: center;
		margin: 0.5rem auto;
		max-width: 85%;
		padding: 0.25rem 0.7rem;
		border-radius: 8px;
		background: var(--surface);
		color: var(--muted);
		font-size: 0.82rem;
		width: fit-content;
	}
	.area {
		flex: 1;
		min-height: 0;
		position: relative;
		display: flex;
		flex-direction: column;
	}
	.floating-day {
		position: absolute;
		top: 0.5rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 1;
		margin: 0;
		padding: 0.15rem 0.7rem;
		border-radius: 8px;
		background: var(--surface);
		border: 1px solid var(--line);
		color: var(--muted);
		font-size: 0.8rem;
		/* não atrapalha o toque nem a busca do dia por elementFromPoint */
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.2s;
	}
	.floating-day.visible {
		opacity: 1;
	}
	.copied {
		position: absolute;
		bottom: 0.8rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 1;
		margin: 0;
		padding: 0.35rem 0.9rem;
		border-radius: 999px;
		background: var(--fg);
		color: var(--bg);
		font-size: 0.85rem;
		white-space: nowrap;
		pointer-events: none;
	}
	.jump {
		position: absolute;
		right: 0.8rem;
		bottom: 0.8rem;
		z-index: 1;
		width: 2.6rem;
		height: 2.6rem;
		background: var(--surface);
		border: 1px solid var(--line);
		color: var(--fg);
		box-shadow: 0 2px 6px rgb(0 0 0 / 0.15);
	}
	.badge {
		position: absolute;
		top: -0.45rem;
		right: -0.3rem;
		min-width: 1.3rem;
		padding: 0 0.3rem;
		border-radius: 999px;
		background: var(--accent);
		color: var(--accent-fg);
		font-size: 0.72rem;
		font-weight: 700;
		line-height: 1.3rem;
		text-align: center;
	}
	.new-line {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin: 0.8rem 0 0.2rem;
		color: var(--accent);
		font-size: 0.8rem;
		font-weight: 600;
	}
	.new-line::before,
	.new-line::after {
		content: '';
		flex: 1;
		border-top: 1px solid currentColor;
		opacity: 0.5;
	}
	.messages {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem 0.3rem;
		overflow-anchor: none;
		display: flex;
		flex-direction: column;
	}
	/* poucas mensagens ficam junto do campo, como nos outros apps; com muitas, a margem some */
	.messages > :first-child {
		margin-top: auto;
	}
	/* o padding dá espaço para a pontinha: content-visibility corta o que passa da borda.
	   Sem flex-shrink: 0, o bloco ainda não desenhado encolhe para caber na área e, ao abrir, não há
	   altura para rolar até "Mensagens novas" (a conversa abria às vezes no topo). */
	.block {
		flex-shrink: 0;
		padding: 0 0.5rem;
		content-visibility: auto;
		contain-intrinsic-size: auto var(--block-estimate);
	}
	.older {
		display: block;
		margin: 0.5rem auto;
	}
	.empty {
		text-align: center;
		margin-top: 2rem;
	}
	.day {
		text-align: center;
		color: var(--muted);
		font-size: 0.8rem;
		margin: 0.9rem 0 0.4rem;
	}
</style>
