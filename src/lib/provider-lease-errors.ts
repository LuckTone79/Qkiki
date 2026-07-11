const TRANSIENT_PRISMA_TRANSACTION_CODES = new Set(["P2028", "P2034"]);

export class ProviderLeaseCapacityTimeoutError extends Error {
  readonly code = "PROVIDER_LEASE_CAPACITY_TIMEOUT";

  constructor(provider: string, timeoutMs: number) {
    super(
      `Provider capacity for ${provider} was not available within ${timeoutMs}ms.`,
    );
    this.name = "ProviderLeaseCapacityTimeoutError";
  }
}

function getErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "");
}

export function isProviderLeaseTransientError(error: unknown) {
  const code = getErrorCode(error);
  if (TRANSIENT_PRISMA_TRANSACTION_CODES.has(code)) {
    return true;
  }

  const message = getErrorMessage(error);
  return (
    /Transaction API error/i.test(message) &&
    /Unable to start a transaction/i.test(message)
  );
}
