// Lista padrão de relays: a mais nova entre a baixada e a embutida no app (RNF-36).
import { asset } from '$app/paths';
import { loadRelayList, type RelayList } from '@lerolero/core';
import embedded from '../../static/relays.json';

let cached: Promise<RelayList> | undefined;

export function relayList(): Promise<RelayList> {
	cached ??= loadRelayList(embedded, async () => {
		const res = await fetch(asset('relays.json'), { cache: 'no-cache' });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return res.json();
	});
	return cached;
}
