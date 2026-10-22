// Web Worker com o cofre da identidade: Argon2id e chave privada ficam fora da thread da interface.
import { createVault, expose, type Endpoint } from '@lerolero/core';

expose(createVault(), self as unknown as Endpoint);
