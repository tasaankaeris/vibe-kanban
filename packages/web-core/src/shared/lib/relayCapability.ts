export const RELAY_REQUIRES_SECURE_CONTEXT_CODE =
  'RELAY_REQUIRES_SECURE_CONTEXT' as const;

export const RELAY_REQUIRES_SECURE_CONTEXT_MESSAGE =
  'Relay is unavailable on HTTP. Use HTTPS to enable relay features.';

export class RelayRequiresSecureContextError extends Error {
  readonly code = RELAY_REQUIRES_SECURE_CONTEXT_CODE;

  constructor() {
    super(RELAY_REQUIRES_SECURE_CONTEXT_MESSAGE);
    this.name = 'RelayRequiresSecureContextError';
  }
}

/** Whether relay features are available in the current browser context. */
export function isRelayAvailable(): boolean {
  return globalThis.isSecureContext === true;
}

/** Throws {@link RelayRequiresSecureContextError} when relay is unavailable. */
export function assertRelayAvailable(): void {
  if (!isRelayAvailable()) {
    throw new RelayRequiresSecureContextError();
  }
}
