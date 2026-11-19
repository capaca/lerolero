// O que o app Android (ADR-0011) faz pelo aparelho, porque o WebView do APK não tem o que o Chrome tem: gerenciador
// de senhas, download por link, menu de compartilhar e impressão (vistos sem funcionar pelo Pedro na v0.18.1). O
// plugin Aparelho é do próprio APK (packages/android, AparelhoPlugin.java); os outros dois são os oficiais.

import { Capacitor, registerPlugin } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { m } from '#lib/paraglide/messages.js';

interface AparelhoPlugin {
	guardarSenha(options: { conta: string; senha: string }): Promise<void>;
	lerSenha(): Promise<{ senha?: string }>;
	imprimir(options: { titulo: string }): Promise<void>;
	avisar(options: { texto: string }): Promise<void>;
}

const Aparelho = registerPlugin<AparelhoPlugin>('Aparelho');

export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

/** O erro do plugin com o nome que a interface já entende (`AbortError` = a pessoa cancelou). */
function named(err: unknown): Error {
	const code = (err as { code?: string }).code;
	return Object.assign(new Error((err as Error).message), { name: code || (err as Error).name });
}

/** Guarda o código de recuperação no Gerenciador de senhas do Google (RF-09 b). */
export async function storePasswordNative(account: string, password: string) {
	try {
		await Aparelho.guardarSenha({ conta: account, senha: password });
	} catch (err) {
		throw named(err);
	}
}

/** O código guardado, para a restauração; `undefined` sem nada guardado. */
export async function readPasswordNative(): Promise<string | undefined> {
	return (await Aparelho.lerSenha()).senha || undefined;
}

export const printNative = () => Aparelho.imprimir({ titulo: m.app_nome() });

const FOLDER = 'Lero-lero';

function base64(blob: Blob): Promise<string> {
	return new Promise((done, fail) => {
		const reader = new FileReader();
		reader.onload = () => done(String(reader.result).slice(String(reader.result).indexOf(',') + 1));
		reader.onerror = () => fail(reader.error);
		reader.readAsDataURL(blob);
	});
}

/** "nome (2).pdf" para não escrever por cima do que já está na pasta. */
function numbered(name: string, n: number): string {
	if (n === 1) return name;
	const dot = name.lastIndexOf('.');
	return dot > 0 ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`;
}

async function freeName(name: string, directory: Directory): Promise<string> {
	for (let n = 1; n < 100; n++) {
		const path = `${FOLDER}/${numbered(name, n)}`;
		try {
			await Filesystem.stat({ path, directory });
		} catch {
			return path;
		}
	}
	return `${FOLDER}/${numbered(name, Date.now())}`;
}

/** Salva em Documentos/Lero-lero (RF-45) e avisa onde, num aviso do sistema. */
export async function saveFileNative(blob: Blob, name: string) {
	const path = await freeName(name, Directory.Documents);
	await Filesystem.writeFile({ path, data: await base64(blob), directory: Directory.Documents, recursive: true });
	await Aparelho.avisar({ texto: m.arquivo_salvo_em({ pasta: `${m.pasta_documentos()}/${FOLDER}` }) }).catch(() => {});
}

/** Menu de compartilhar do Android com o arquivo (gravado antes no cache do app, que o sistema limpa). */
export async function shareFileNative(blob: Blob, name: string, title: string) {
	const { uri } = await Filesystem.writeFile({ path: name, data: await base64(blob), directory: Directory.Cache });
	try {
		await Share.share({ title, files: [uri] });
	} catch (err) {
		throw cancelled(err);
	}
}

/** Menu de compartilhar do Android com um link (o convite). */
export async function shareLinkNative(options: { title: string; text: string; url: string }) {
	try {
		await Share.share(options);
	} catch (err) {
		throw cancelled(err);
	}
}

// o plugin de compartilhar rejeita com "Share canceled" quando a pessoa fecha o menu
const cancelled = (err: unknown) => (/cancel/i.test((err as Error).message) ? Object.assign(new Error('cancelado'), { name: 'AbortError' }) : err);
