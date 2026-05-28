function fillRandomBytes(bytes: Uint8Array): void {
  const crypto = globalThis.crypto;
  if (crypto && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
    return;
  }
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
}

function formatUuidV4(bytes: Uint8Array): string {
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
}

/** RFC 4122 v4 UUID for insecure HTTP contexts (no native randomUUID). */
export function uuidV4ForHttp(): string {
  const bytes = new Uint8Array(16);
  fillRandomBytes(bytes);
  return formatUuidV4(bytes);
}

/**
 * Prefer native randomUUID in secure contexts; otherwise use HTTP-safe v4.
 */
export function safeUUID(): string {
  if (
    globalThis.isSecureContext === true &&
    typeof globalThis.crypto?.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID();
  }
  return uuidV4ForHttp();
}
