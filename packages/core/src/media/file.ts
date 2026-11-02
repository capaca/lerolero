// Arquivos além de foto e áudio (RF-44): limite, tipos bloqueados e nome. O nome e o tipo vêm de quem enviou, então
// tudo aqui vale nos dois lados: um cliente modificado envia o que quiser (T22).

/** Limite por arquivo. O Blossom jumble corta em 20 MiB; os outros não informam (decidido em 2026-10-30). */
export const FILE_MAX_BYTES = 20_000_000;

const NAME_MAX_LENGTH = 120;

// o que roda ao abrir, no aparelho ou no navegador
const BLOCKED_EXTENSIONS = new Set(
	(
		'exe msi bat cmd com scr pif cpl msc jar apk apks xapk aab app dmg pkg deb rpm sh ps1 psm1 vbs vbe js jse mjs ' +
		'wsf wsh hta lnk reg inf gadget desktop url iso html htm xhtml shtml svg mht mhtml'
	).split(' ')
);
const BLOCKED_TYPES = /(x-msdownload|x-msdos-program|x-msi|android\.package-archive|x-sh\b|javascript|ecmascript|html|svg)/i;

/** Tira do nome o que engana ou escapa da pasta: caminhos, controles e inversão de texto (`fdp.exe` escrito ao contrário). */
export function cleanFileName(name: string | undefined): string | undefined {
	const clean = (name ?? '')
		// eslint-disable-next-line no-control-regex
		.replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩﻿]/g, '')
		.replace(/[/\\:]/g, '_')
		.replace(/^[\s.]+|[\s.]+$/g, '');
	// corta o começo: a extensão é o que decide o bloqueio
	return clean ? clean.slice(-NAME_MAX_LENGTH) : undefined;
}

/** Extensão em minúsculas, sem o ponto; vazia se não houver. */
export function fileExtension(name: string | undefined): string {
	const dot = (name ?? '').lastIndexOf('.');
	return dot > 0 ? name!.slice(dot + 1).toLowerCase() : '';
}

/** Não baixa, não abre e não salva: executável, ou maior que o limite. */
export function isBlockedFile(media: { name?: string; type: string; size: number }): boolean {
	return BLOCKED_EXTENSIONS.has(fileExtension(cleanFileName(media.name))) || BLOCKED_TYPES.test(media.type) || media.size > FILE_MAX_BYTES;
}

const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

/** Nome ao salvar no aparelho: o que veio na mensagem ou, na foto, um feito do hash. */
export function saveName(media: { name?: string; type: string; ox: string }): string {
	const name = cleanFileName(media.name);
	if (name) return name;
	const extension = EXTENSIONS[media.type];
	return `lerolero-${media.ox.slice(0, 8)}${extension ? `.${extension}` : ''}`;
}
