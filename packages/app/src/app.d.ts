// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	const __APP_RELEASE__: string;
	const __APP_HOMOLOG__: boolean;
	const __APP_LOCAL__: boolean;
	const __APP_LOCAL_COLOR__: string;

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
