import { npubEncode } from 'nostr-tools/nip19';

/** Chave pública no formato legível do Nostr (npub1…), para mostrar e copiar. */
export const toNpub = (publicKey: string): string => npubEncode(publicKey);
