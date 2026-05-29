import { uuidV4ForHttp } from './uuid';

/**
 * Install `crypto.randomUUID` when missing (plain HTTP / non-secure contexts).
 * Semantics match {@link uuidV4ForHttp}.
 *
 * Required because @tanstack/db calls `crypto.randomUUID()` directly on inserts
 * (transaction + mutation ids). Must run before any app modules load — use
 * `cryptoPolyfill.ts` as the first module script in each SPA index.html.
 */
export function installCryptoRandomUUIDPolyfill(): void {
  try {
    const cryptoObj = globalThis.crypto;
    if (!cryptoObj || typeof cryptoObj.randomUUID === 'function') {
      return;
    }

    const randomUUID = (() => uuidV4ForHttp()) as Crypto['randomUUID'];

    try {
      cryptoObj.randomUUID = randomUUID;
    } catch {
      Object.defineProperty(cryptoObj, 'randomUUID', {
        value: randomUUID,
        writable: true,
        configurable: true,
      });
    }
  } catch {
    // Never break page load when crypto is unavailable.
  }
}
