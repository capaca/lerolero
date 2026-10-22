// Lista padrão de relays e servidores Blossom (relays.json na raiz do repositório).
// É baixada em tempo de execução para poder mudar sem nova versão do app (RNF-36),
// então tudo o que vem dela é validado antes de usar.

export type RelayList = {
	versao: 1;
	atualizado: string;
	/** relays de DM sugeridos para o kind 10050 de quem se cadastra (NIP-17: de 1 a 3) */
	dm: string[];
	dmReserva: string[];
	/** relays para publicar e achar perfis e listas (kinds 0, 10050, 10063) */
	geral: string[];
	/** servidores de mídia cifrada (ADR-0004: envio para 2) */
	blossom: string[];
	blossomReserva: string[];
};

const RELAY_FIELDS = ['dm', 'dmReserva', 'geral'] as const;
const BLOSSOM_FIELDS = ['blossom', 'blossomReserva'] as const;

/** Valida e normaliza a lista. Lança um erro que diz qual campo está errado. */
export function parseRelayList(input: unknown): RelayList {
	if (typeof input !== 'object' || input === null) throw new Error('lista de relays: não é um objeto');
	const raw = input as Record<string, unknown>;
	if (raw.versao !== 1) throw new Error(`lista de relays: versão não suportada (${String(raw.versao)})`);
	if (typeof raw.atualizado !== 'string') throw new Error('lista de relays: falta a data de atualização');

	const urls = (field: string, protocol: 'wss:' | 'https:', required: boolean) => {
		const value = raw[field] ?? (required ? undefined : []);
		if (!Array.isArray(value)) throw new Error(`lista de relays: "${field}" não é uma lista`);
		const out = value.map((item) => normalizeUrl(item, protocol, field));
		if (required && out.length === 0) throw new Error(`lista de relays: "${field}" está vazia`);
		return [...new Set(out)];
	};

	const list = {
		versao: 1,
		atualizado: raw.atualizado,
		...Object.fromEntries(RELAY_FIELDS.map((f) => [f, urls(f, 'wss:', f !== 'dmReserva')])),
		...Object.fromEntries(BLOSSOM_FIELDS.map((f) => [f, urls(f, 'https:', f === 'blossom')]))
	} as RelayList;

	if (list.dm.length > 3) throw new Error('lista de relays: "dm" tem mais de 3 relays (NIP-17 recomenda de 1 a 3)');
	return list;
}

function normalizeUrl(value: unknown, protocol: 'wss:' | 'https:', field: string): string {
	let url: URL;
	try {
		url = new URL(String(value).trim());
	} catch {
		throw new Error(`lista de relays: "${field}" tem um endereço inválido: ${String(value)}`);
	}
	if (url.protocol !== protocol) {
		throw new Error(`lista de relays: "${field}" só aceita ${protocol}// (recebeu ${url.href})`);
	}
	return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, '')}`;
}
