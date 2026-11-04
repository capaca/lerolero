// Entrada do Worker: o runtime só aceita handlers exportados aqui, então a lógica fica em repassador.ts
import { handle, type Env } from './repassador.ts';

export default {
	fetch(request: Request, env: Env): Promise<Response> {
		return handle(request, env, fetch);
	},
};
