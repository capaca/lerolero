<script lang="ts">
	// Conversa (1:1 ou grupo): mensagens, avisos de grupo, menu da mensagem e campo de envio.
	// O topo e os avisos de cima ficam com a tela que usa o componente.
	import { applyChanges, canEdit, contactName, deliveryOf, forwardOf, isBlockedFile, keepUnchanged, keepUnchangedGroups, olderPage, sameRecord, saveName, withMentionLabels, type MessageRecord, type ReactionRecord } from '@lerolero/core';
	import { page } from '$app/state';
	import { onDestroy, tick, type Snippet } from 'svelte';
	import Composer from './Composer.svelte';
	import Icon from './Icon.svelte';
	import MessageBubble from './MessageBubble.svelte';
	import ForwardSheet from './ForwardSheet.svelte';
	import MessageMenu from './MessageMenu.svelte';
	import Sheet from './Sheet.svelte';
	import { dayKey, formatDay, formatTime } from '#lib/format.ts';
	import { friendlyError } from '#lib/errors.ts';
	import { memberName, noticeText, type NameOf } from '#lib/notices.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { saveFile } from '#lib/save-file.ts';
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
	// "carregar anteriores" põe na tela tantas por quadro: 50 balões levavam 55 a 80 ms no celular de referência
	const OLDER_CHUNK = 25;
	// numa rajada do que chega pela rede, o intervalo mínimo entre uma recarga e a seguinte (P17)
	const RELOAD_GAP_MS = 250;
	// as últimas que a recarga parcial relê sempre, além das que a sessão avisou que mudaram
	const RECENT_CHECK = 20;

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

	// seleção de várias mensagens (RF-28): favoritar, copiar, encaminhar e apagar de uma vez
	let selecting = $state(false);
	let selected = $state.raw(new Set<string>());
	let confirmingDelete = $state(false);
	const picked = $derived(messages.filter((x) => selected.has(x.id)));

	function startSelecting(message: MessageRecord) {
		menuFor = undefined;
		selected = new Set([message.id]);
		selecting = true;
	}
	function stopSelecting() {
		selecting = false;
		confirmingDelete = false;
		selected = new Set();
	}
	function togglePick(id: string) {
		const next = new Set(selected);
		if (!next.delete(id)) next.add(id);
		selected = next;
		// desmarcou a última: sai do modo
		if (!next.size) stopSelecting();
	}
	async function starMessages(ids: string[], starred: boolean) {
		menuFor = undefined;
		try {
			await session.setStarred(ids, starred);
			stopSelecting();
		} catch (err) {
			error = friendlyError(err);
		}
	}
	/** Sem a estrela em todas, favorita todas; se todas já são favoritas, tira. */
	const allStarred = $derived(picked.length > 0 && picked.every((x) => x.starred));
	const copyable = $derived(picked.filter((x) => !x.media && x.text));
	const forwardable = $derived(picked.filter((x) => forwardOf(x)));
	const allMine = $derived(picked.length > 0 && picked.every((x) => x.sender === me));

	async function copyPicked() {
		// uma só: o texto como está; várias: com hora e nome, para o texto colado fazer sentido
		const text =
			copyable.length === 1
				? withMentionLabels(copyable[0].text, mentionLabel)
				: copyable.map((x) => `[${formatTime(x.createdAt)}] ${nameFor(x.sender)}: ${withMentionLabels(x.text, mentionLabel)}`).join('\n');
		try {
			await navigator.clipboard.writeText(text);
			stopSelecting();
			copied = true;
			clearTimeout(copiedTimer);
			copiedTimer = setTimeout(() => (copied = false), 2000);
		} catch {
			error = m.conversa_erro_copiar();
		}
	}
	async function deletePicked(forEveryone: boolean) {
		const list = picked;
		stopSelecting();
		try {
			for (const message of list) {
				if (forEveryone) await session.deleteForEveryone(conversationId, message.id);
				else await session.deleteForMe(message.id);
			}
		} catch (err) {
			error = friendlyError(err);
		}
	}

	// responder (RF-22): o campo mostra a citação; vale para o próximo texto enviado
	let replying = $state.raw<MessageRecord>();

	const nameFor = (sender: string) => (sender === me ? m.citada_voce() : nameOf ? memberName(nameOf(sender)) : otherName);
	function previewOf(message: MessageRecord): string {
		if (message.deleted) return m.citada_apagada();
		if (message.media) return message.media.type.startsWith('audio/') ? m.previa_audio() : message.media.type.startsWith('image/') ? m.previa_foto() : '';
		return withMentionLabels(message.text, mentionLabel).replace(/\s+/g, ' ').trim().slice(0, 120);
	}

	function startReply() {
		editing = undefined;
		replying = menuFor;
		menuFor = undefined;
	}

	// editar (RF-24): o campo recebe o texto da mensagem; enviar troca o texto em vez de mandar uma nova
	let editing = $state.raw<MessageRecord>();
	function startEdit() {
		replying = undefined;
		editing = menuFor;
		menuFor = undefined;
	}

	// mencionar (RF-35): só nos grupos, entre os outros membros de agora
	const mentionLabel = (publicKey: string) => `@${publicKey === me ? memberName({ me: true }) : nameOf ? memberName(nameOf(publicKey)) : otherName}`;
	const members = $derived(nameOf ? recipients.map((publicKey) => ({ publicKey, name: memberName(nameOf(publicKey)) })) : undefined);

	async function react(message: MessageRecord, emoji: string) {
		menuFor = undefined;
		try {
			await session.react(conversationId, message.id, emoji);
		} catch (err) {
			error = friendlyError(err);
		}
	}

	// Os chips e a citação de cada balão só mudam de objeto quando o que eles mostram muda: com um objeto novo a
	// cada recarga, todos os balões da conversa eram redesenhados a cada mensagem que chegava (P17).
	type Chip = { emoji: string; count: number; mine: boolean };
	const NO_CHIPS: Chip[] = [];
	const chipCache = new Map<string, { from: ReactionRecord[]; chips: Chip[] }>();
	/** Reações de uma mensagem somadas por emoji, na ordem em que apareceram. */
	function chipsOf(messageId: string) {
		const from = reactions.get(messageId);
		if (!from) return NO_CHIPS;
		const cached = chipCache.get(messageId);
		if (cached?.from === from) return cached.chips;
		const chips: Chip[] = [];
		chipCache.set(messageId, { from, chips });
		for (const reaction of from) {
			const chip = chips.find((c) => c.emoji === reaction.emoji);
			if (chip) {
				chip.count++;
				chip.mine ||= reaction.sender === me;
			} else chips.push({ emoji: reaction.emoji, count: 1, mine: reaction.sender === me });
		}
		return chips;
	}
	const byId = $derived(new Map(messages.map((x) => [x.id, x])));
	const quoteCache = new Map<string, { name: string; message: MessageRecord | undefined }>();
	function quoteOf(id: string) {
		const message = byId.get(id) ?? quoted.get(id);
		const name = message ? nameFor(message.sender) : '';
		const cached = quoteCache.get(id);
		if (cached && cached.message === message && cached.name === name) return cached;
		const quote = { name, message };
		quoteCache.set(id, quote);
		return quote;
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
			await navigator.clipboard.writeText(withMentionLabels(message.text, mentionLabel));
			copied = true;
			clearTimeout(copiedTimer);
			copiedTimer = setTimeout(() => (copied = false), 2000);
		} catch {
			error = m.conversa_erro_copiar();
		}
	}
	onDestroy(() => clearTimeout(copiedTimer));


	// salvar no aparelho (RF-45): voz fica de fora, e o pedido de quem não é contato só abre depois de aceitar (RF-12)
	const canSave = (message: MessageRecord) =>
		!!message.media &&
		!message.deleted &&
		!message.media.type.startsWith('audio/') &&
		!isBlockedFile(message.media) &&
		(message.sender === me || linkMode?.(message.sender) !== 'texto');
	async function saveMessage() {
		const media = menuFor?.media;
		menuFor = undefined;
		if (!media) return;
		const hadFile = !!(await session.downloadedMedia(media.ox));
		try {
			await saveFile(await session.openMedia(media), saveName(media));
		} catch (err) {
			// baixou agora e o iPhone perdeu o toque: o arquivo já está aqui, é só repetir
			error = !hadFile && (err as Error).name === 'NotAllowedError' ? m.erro_salvar_de_novo() : friendlyError(err);
		}
	}

	// encaminhar: o menu fecha e abre a escolha do destino; ao escolher, vai para a conversa e a tela segue nela
	let forwarding = $state.raw<MessageRecord[]>();
	let forwardedCount = $state(1);
	async function forwardTo(destination: string) {
		const list = forwarding;
		forwarding = undefined;
		if (!list?.length) return;
		try {
			for (const message of list) await session.forwardMessage(message.id, destination);
			forwardedCount = list.length;
			stopSelecting();
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
	// Cada mensagem tem uma vaga fixa enquanto a conversa está aberta, herdada da recarga anterior, e o bloco é a vaga
	// dividida por BLOCK_SIZE. Fatiar pelo índice fazia "carregar anteriores" (200 em cima) trocar todas as mensagens
	// de bloco, e cada bloco tem o seu {#each}: todos os balões eram destruídos e refeitos, e a rolagem engasgava
	// (RNF-14). Assim as anteriores entram em blocos novos na frente e os da tela ficam como estão.
	let slotOf = new Map<string, number>();
	const blocks = $derived.by(() => {
		const known = messages.findIndex((x) => slotOf.has(x.id));
		const base = known < 0 ? 0 : slotOf.get(messages[known].id)! - known;
		slotOf = new Map(messages.map((x, i) => [x.id, base + i]));
		const out: { key: number; items: Item[] }[] = [];
		let block: { key: number; items: Item[] } | undefined;
		const add = (item: Item, slot: number) => {
			const key = Math.floor(slot / BLOCK_SIZE);
			if (block?.key !== key) out.push((block = { key, items: [] }));
			block.items.push(item);
		};
		let lastDay: number | undefined;
		let dayLabel = '';
		let previous: Extract<Item, { type: 'msg' }> | undefined;
		for (const [i, message] of messages.entries()) {
			const slot = base + i;
			const day = dayKey(message.createdAt);
			if (day !== lastDay) {
				dayLabel = formatDay(message.createdAt);
				add({ type: 'dia', key: day, label: dayLabel }, slot);
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
			if (message.id === newFrom) add({ type: 'novas' }, slot);
			previous = { type: 'msg', message, first, last: false, day: dayLabel };
			add(previous, slot);
		}
		if (previous) previous.last = true;
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

	// Uma recarga por vez (P17), e numa rajada do que chega pela rede, no máximo uma a cada RELOAD_GAP_MS: as
	// mudanças do intervalo vão juntas para a tela. Desenhar a cada mensagem atrasava o recebimento da seguinte.
	// O que eu faço (enviar, reagir...) recarrega na hora (RNF-12).
	let running: Promise<void> | undefined;
	let again = false;
	let againNow = false;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let lastEnd = -Infinity;
	function refresh(now = false) {
		// enquanto as anteriores entram na tela, a recarga espera: senão gravaria a janela sem o pedaço que entrou
		if (running || loadingOlder) {
			again = true;
			againNow ||= now;
			return;
		}
		const wait = now || firstLoad ? 0 : lastEnd + RELOAD_GAP_MS - performance.now();
		if (wait > 0) {
			timer ??= setTimeout(() => ((timer = undefined), refresh()), wait);
			return;
		}
		clearTimeout(timer);
		timer = undefined;
		running = load()
			.catch((err) => {
				// as mudanças já saíram da sessão (takeChanges): a próxima relê a página inteira
				wantsAll = true;
				throw err;
			})
			.finally(() => {
				running = undefined;
				lastEnd = performance.now();
				if (!again) return;
				const urgent = againNow;
				again = againNow = false;
				refresh(urgent);
			});
	}
	onDestroy(() => clearTimeout(timer));

	// A página inteira: ao abrir, em "carregar anteriores" e quando mudou o que não é só mensagem (reação, membros...)
	async function readAll(limit: number) {
		const [all, conversation, reactionList] = await Promise.all([
			session.getMessages(conversationId, limit + 1),
			session.getConversation(conversationId),
			session.getReactions(conversationId)
		]);
		const older = all.length > limit;
		const list = older ? all.slice(1) : all;
		const byMessage = new Map<string, ReactionRecord[]>();
		for (const reaction of reactionList.sort((a, b) => a.createdAt - b.createdAt)) {
			byMessage.set(reaction.messageId, [...(byMessage.get(reaction.messageId) ?? []), reaction]);
		}
		reactions = keepUnchangedGroups(reactions, byMessage);
		recipients = conversation?.members ?? [];
		// citações de mensagens mais antigas que a página
		const here = new Set(list.map((x) => x.id));
		const found = new Map<string, MessageRecord>();
		for (const id of new Set(list.flatMap((x) => (x.replyTo && !here.has(x.replyTo) ? [x.replyTo] : [])))) {
			const original = await session.getMessage(id);
			const before = quoted.get(id);
			if (original) found.set(id, before && sameRecord(before, original) ? before : original);
		}
		quoted = found;
		// pode ter mudado o que barrava a "lida" (ex.: aceitou o pedido): confere de novo todas na tela
		askedRead.clear();
		return { list, older, conversation };
	}

	// Só as mensagens que mudaram (P17): numa rajada, reler a página, as reações e as citações a cada mensagem que
	// chegava deixava o recebimento esperando o banco. Vêm junto as últimas da conversa (uma leitura pelo índice), para
	// a que entrou sem aviso não ficar de fora, e a conversa, para os destinatários (a tela pode abrir antes de ela
	// existir, e sem eles a "lida" não conta).
	async function readChanged(ids: Set<string>, limit: number) {
		const read = (id: string) => session.getMessage(id).then((message) => [id, message] as const);
		const [changed, last, conversation] = await Promise.all([
			Promise.all([...ids].map(read)),
			session.getMessages(conversationId, RECENT_CHECK),
			session.getConversation(conversationId)
		]);
		const members = conversation?.members ?? [];
		if (members.length !== recipients.length || members.some((k, i) => k !== recipients[i])) recipients = members;
		const { list, older } = applyChanges(messages, [...last.map((x) => [x.id, x] as const), ...changed], conversationId, limit);
		// a citação de uma que chegou, de fora da página, e a citada que mudou
		const here = new Set(list.map((x) => x.id));
		const missing = list.filter((x) => ids.has(x.id) && x.replyTo && !here.has(x.replyTo) && !quoted.has(x.replyTo)).map((x) => x.replyTo!);
		const stale = [...quoted.keys()].filter((id) => ids.has(id));
		if (missing.length || stale.length) {
			const next = new Map(quoted);
			for (const [id, original] of await Promise.all([...new Set([...missing, ...stale])].map(read))) {
				if (original) next.set(id, original);
				else next.delete(id);
			}
			quoted = next;
		}
		return { list, older: older || hasOlder, conversation };
	}

	/** a recarga parcial falhou e as mudanças já saíram da sessão: a próxima relê tudo */
	let wantsAll = false;

	async function load() {
		const limit = PAGE_SIZE * (1 + extraPages);
		const changes = session.takeChanges(conversationId);
		const { list, older, conversation } =
			firstLoad || wantsAll || changes === 'tudo' ? await readAll(limit) : await readChanged(changes, limit);
		wantsAll = false;
		// só chegada ou envio de mensagem leva ao fim: estrela, reação e confirmação também recarregam a lista e não
		// podem arrancar quem lê lá em cima
		const grew = list.at(-1)?.id !== messages.at(-1)?.id;
		const stick = firstLoad || nearBottom() || (grew && list.at(-1)?.sender === me);
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
		hasOlder = older;
		messages = keepUnchanged(messages, list);
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
		const wasFirst = firstLoad;
		firstLoad = false;
		if (wasFirst) await focusRequested();
		if (conversation?.unread) await session.markRead(conversationId);
		acknowledgeVisible();
	}

	// Abriu por uma favorita (?msg=): rola até a mensagem e a destaca um instante
	async function focusRequested() {
		const id = page.url.searchParams.get('msg');
		if (!id) return;
		await tick();
		const row = scroller?.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`);
		if (!row) return;
		row.scrollIntoView({ block: 'center' });
		row.classList.add('flash');
		setTimeout(() => row.classList.remove('flash'), 1800);
	}

	// "Lida" (RF-50): o que está na tela e veio dos outros; só com o app à vista, não com a aba escondida
	// Na recarga parcial, cada uma é pedida uma vez: até a confirmação sair, o `ack` no banco ainda não é "lida", e
	// reconferir todas a cada recarga lia o banco três vezes por mensagem (P17). A recarga inteira confere todas de novo.
	const askedRead = new Set<string>();
	function acknowledgeVisible() {
		if (document.visibilityState !== 'visible') return;
		const ids = messages.filter((x) => x.sender !== me && !x.notice && !x.deleted && x.ack !== 'lida' && !askedRead.has(x.id)).map((x) => x.id);
		for (const id of ids) askedRead.add(id);
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

	// recarrega quando muda a conversa ou algo nela (P17: mudança em outra conversa não recarrega esta)
	$effect(() => {
		void session.conversationVersion(conversationId);
		session.openConversationId = conversationId;
		refresh(session.changedByMe(conversationId));
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

	// "Carregar anteriores" (RNF-14): lê só a página de antes da primeira da tela e a mostra aos poucos (OLDER_CHUNK por quadro),
	// mantendo na tela a mensagem que a pessoa estava lendo. Pôr 200 balões de uma vez travava a rolagem no celular
	// de referência (até ~300 ms); um toque a mais durante o carregamento não pede outra página.
	// variável comum: o refresh, chamado dentro de um $effect, não pode passar a depender dela
	let loadingOlder = false;
	let olderBusy = $state(false);
	async function loadOlder() {
		if (loadingOlder || !messages.length) return;
		loadingOlder = olderBusy = true;
		try {
			while (running) await running;
			const first = messages[0];
			const sameSecond = messages.filter((x) => x.createdAt === first.createdAt).length;
			const read = await session.getMessages(conversationId, PAGE_SIZE + 1 + sameSecond, first.createdAt + 1);
			const { page, more } = olderPage(read, first, PAGE_SIZE);
			// a recarga inteira, se vier, já lê a janela com esta página
			extraPages++;
			await quoteFromBefore(page);
			for (let end = page.length; end > 0; end -= OLDER_CHUNK) {
				const chunk = page.slice(Math.max(0, end - OLDER_CHUNK), end);
				const before = scroller!.scrollHeight;
				messages = [...chunk, ...messages.filter((x) => !chunk.some((c) => c.id === x.id))];
				await tick();
				scroller!.scrollTop += scroller!.scrollHeight - before;
				if (end > OLDER_CHUNK) await new Promise(requestAnimationFrame);
			}
			hasOlder = more;
		} finally {
			loadingOlder = olderBusy = false;
			if (again) {
				const urgent = againNow;
				again = againNow = false;
				refresh(urgent);
			}
		}
	}
	/** As citações das anteriores a mensagens de mais antes ainda, que não estão na tela. */
	async function quoteFromBefore(page: MessageRecord[]) {
		const here = new Set([...page, ...messages].map((x) => x.id));
		const missing = [...new Set(page.flatMap((x) => (x.replyTo && !here.has(x.replyTo) && !quoted.has(x.replyTo) ? [x.replyTo] : [])))];
		if (!missing.length) return;
		const next = new Map(quoted);
		for (const id of missing) {
			const original = await session.getMessage(id);
			if (original) next.set(id, original);
		}
		quoted = next;
	}

</script>

<div class="chat">
	{#if selecting}
		<div class="selection" role="toolbar" aria-label={m.selecao_contagem({ count: picked.length })}>
			<button type="button" class="round ghost" onclick={stopSelecting} aria-label={m.selecao_cancelar()}><Icon name="x" /></button>
			<strong class="count">{m.selecao_contagem({ count: picked.length })}</strong>
			<button type="button" class="round ghost" onclick={() => starMessages(picked.map((x) => x.id), !allStarred)} aria-label={allStarred ? m.menu_desfavoritar() : m.menu_favoritar()}>
				<Icon name="star" />
			</button>
			<button type="button" class="round ghost" disabled={!copyable.length} onclick={copyPicked} aria-label={m.menu_copiar()}><Icon name="copy" /></button>
			<button
				type="button"
				class="round ghost"
				disabled={!forwardable.length}
				onclick={() => ((forwarding = forwardable), (forwardedCount = forwardable.length))}
				aria-label={m.menu_encaminhar()}
			>
				<Icon name="forward" />
			</button>
			<button type="button" class="round ghost" onclick={() => (confirmingDelete = true)} aria-label={m.selecao_apagar()}><Icon name="trash" /></button>
		</div>
	{:else}
		{@render header()}
	{/if}
	{@render banner?.()}

	<div class="area">
		<p class="floating-day" class:visible={showDay} aria-hidden="true">{floatingDay}</p>
		<div class="messages" bind:this={scroller} {onscroll} aria-live="polite">
			{#if hasOlder}
				<button class="link older" onclick={loadOlder} disabled={olderBusy}>{m.conversa_carregar_anteriores()}</button>
			{/if}
			{#if messages.length === 0 && loaded}
				<p class="hint empty">{m.conversa_vazia()}</p>
			{/if}
			{#each blocks as block (block.key)}
				<div class="block" style:--block-estimate="{block.items.length * 56}px">
					{#each block.items as item (item.type === 'msg' ? item.message.id : item.type === 'dia' ? `d${item.key}` : 'novas')}
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
								quote={msg.replyTo ? quoteOf(msg.replyTo) : undefined}
								reactions={chipsOf(msg.id)}
								selecting={selecting}
								selected={selected.has(msg.id)}
								onpick={() => togglePick(msg.id)}
								onquote={() => goToQuoted(msg.replyTo!)}
								onreact={(emoji) => react(msg, emoji)}
								onlink={(href, host) => (pendingLink = { href, host })}
								{mentionLabel}
								onmenu={() => openMenu(msg)}
							/>
						{/if}
					{/each}
				</div>
			{/each}
		</div>
		{#if forwarded}
			<p class="copied" role="status">{forwardedCount > 1 ? m.selecao_encaminhadas({ count: forwardedCount }) : m.conversa_encaminhada()}</p>
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
			onedit={!closed && me && canEdit(menuFor, me) ? startEdit : undefined}
			oncopy={menuFor.media ? undefined : copyMessage}
			onsave={canSave(menuFor) ? saveMessage : undefined}
			onforward={forwardOf(menuFor)
				? () => {
						forwarding = [menuFor!];
						forwardedCount = 1;
						menuFor = undefined;
					}
				: undefined}
			starred={!!menuFor.starred}
			onstar={() => starMessages([menuFor!.id], !menuFor!.starred)}
			onselect={() => startSelecting(menuFor!)}
			ondeleteForMe={() => deleteMessage(false)}
			ondeleteForEveryone={() => deleteMessage(true)}
		/>
	{/if}

	{#if confirmingDelete}
		<Sheet label={m.selecao_apagar()} onclose={() => (confirmingDelete = false)}>
			<p><strong>{m.selecao_apagar_pergunta({ count: picked.length })}</strong></p>
			{#if allMine}
				<p class="hint">{nameOf ? m.menu_apagar_todos_dica_grupo() : m.menu_apagar_todos_dica_contato()}</p>
			{/if}
			<div class="actions stack">
				<button class="danger" onclick={() => deletePicked(false)}>{m.menu_apagar_mim()}</button>
				{#if allMine}<button class="danger" onclick={() => deletePicked(true)}>{m.menu_apagar_todos()}</button>{/if}
				<button onclick={() => (confirmingDelete = false)}>{m.comum_cancelar()}</button>
			</div>
		</Sheet>
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
		editing={editing ? { id: editing.id, text: editing.text } : undefined}
		oncancelEdit={() => (editing = undefined)}
		{members}
		{mentionLabel}
		bind:error
	/>
</div>

<style>
	.chat {
		height: calc(100dvh - var(--top-bars, 0px));
		display: flex;
		flex-direction: column;
		max-width: 720px;
		margin: 0 auto;
	}
	.messages :global(.row.flash) {
		background: color-mix(in srgb, var(--accent) 25%, transparent);
		transition: background 0.4s;
	}
	.selection {
		display: flex;
		align-items: center;
		gap: 0.2rem;
		padding: 0.5rem 0.6rem;
		border-bottom: 1px solid var(--line);
		background: var(--surface);
	}
	.selection .count {
		flex: 1;
	}
	.selection button:disabled {
		opacity: 0.35;
	}
	.danger {
		background: var(--danger);
		border-color: var(--danger);
		color: var(--danger-fg);
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
