/**
 * Install `crypto.randomUUID` when missing (plain HTTP / non-secure contexts).
 * Semantics match {@link uuidV4ForHttp} in `./uuid.ts`.
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

    const randomUUID = (): string => {
      const bytes = new Uint8Array(16);
      const c = globalThis.crypto;
      if (c && typeof c.getRandomValues === 'function') {
        c.getRandomValues(bytes);
      } else {
        for (let i = 0; i < 16; i++) {
          bytes[i] = Math.floor(Math.random() * 256);
        }
      }
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
      return (
        hex[0] +
        hex[1] +
        hex[2] +
        hex[3] +
        '-' +
        hex[4] +
        hex[5] +
        '-' +
        hex[6] +
        hex[7] +
        '-' +
        hex[8] +
        hex[9] +
        '-' +
        hex[10] +
        hex[11] +
        hex[12] +
        hex[13] +
        hex[14] +
        hex[15]
      );
    };

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
