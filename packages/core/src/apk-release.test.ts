import { describe, expect, it } from 'vitest';
import { apkDownloadUrl, newerApkRelease } from './apk-release.ts';

const release = (tag: string, extra: Record<string, unknown> = {}) => ({
	tag_name: tag,
	draft: false,
	prerelease: false,
	assets: [{ name: 'lerolero.apk' }],
	...extra
});

describe('newerApkRelease', () => {
	it('avisa só quando a Release é mais nova', () => {
		expect(newerApkRelease('0.17.0', release('v0.18.0'))).toBe('0.18.0');
		expect(newerApkRelease('0.17.0', release('v0.17.1'))).toBe('0.17.1');
		expect(newerApkRelease('0.9.0', release('v0.10.0'))).toBe('0.10.0');
		expect(newerApkRelease('0.17.0', release('v1.0.0'))).toBe('1.0.0');
		expect(newerApkRelease('0.17.0', release('v0.17.0'))).toBeUndefined();
		expect(newerApkRelease('0.18.0', release('v0.17.9'))).toBeUndefined();
	});

	it('não avisa no app de teste nem em dev', () => {
		expect(newerApkRelease('dev', release('v0.18.0'))).toBeUndefined();
		expect(newerApkRelease('homolog-7e698bd', release('v0.18.0'))).toBeUndefined();
	});

	it('ignora a Release sem APK, em rascunho ou que não entende', () => {
		expect(newerApkRelease('0.17.0', release('v0.18.0', { assets: [] }))).toBeUndefined();
		expect(newerApkRelease('0.17.0', release('v0.18.0', { assets: [{ name: 'outro.apk' }, null] }))).toBeUndefined();
		expect(newerApkRelease('0.17.0', release('v0.18.0', { draft: true }))).toBeUndefined();
		expect(newerApkRelease('0.17.0', release('v0.18.0', { prerelease: true }))).toBeUndefined();
		expect(newerApkRelease('0.17.0', release('0.18.0'))).toBeUndefined();
		expect(newerApkRelease('0.17.0', release('v0.18.0-beta'))).toBeUndefined();
		expect(newerApkRelease('0.17.0', { message: 'API rate limit exceeded' })).toBeUndefined();
		expect(newerApkRelease('0.17.0', null)).toBeUndefined();
	});
});

it('apkDownloadUrl monta o link da Release', () => {
	expect(apkDownloadUrl('capaca/lerolero', '0.18.0')).toBe('https://github.com/capaca/lerolero/releases/download/v0.18.0/lerolero.apk');
});
