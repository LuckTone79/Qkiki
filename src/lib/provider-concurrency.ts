import "server-only";

import crypto from "node:crypto";
import type { ProviderName } from "@/lib/ai/types";
import { prisma } from "@/lib/prisma";
import { ProviderLeaseCapacityTimeoutError } from "@/lib/provider-lease-errors";

const PROVIDER_LEASE_TTL_MS = 10 * 60 * 1000;
const PROVIDER_WAIT_MS = 250;
const DEFAULT_PROVIDER_ACQUIRE_TIMEOUT_MS = 15_000;
const MIN_PROVIDER_ACQUIRE_TIMEOUT_MS = 1_000;
const MAX_PROVIDER_ACQUIRE_TIMEOUT_MS = 60_000;
// Expired-lease cleanup is hygiene only (expired leases never count toward the
// limit), so run it on a small fraction of acquisitions instead of every call.
const LEASE_CLEANUP_PROBABILITY = 0.05;

const DEFAULT_PROVIDER_LIMITS: Record<ProviderName, number> = {
  openai: 40,
  anthropic: 20,
  google: 60,
  xai: 20,
};

type ProviderLeaseOwner = {
  ownerKind: string;
  ownerId: string;
};

async function delay(ms: number, signal?: AbortSignal) {
  if (signal?.aborted) {
    throw signal.reason ?? new Error("The operation was aborted.");
  }

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      cleanup();
      reject(signal?.reason ?? new Error("The operation was aborted."));
    };
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function getProviderLimit(provider: ProviderName) {
  const envKey = `PROVIDER_CONCURRENCY_${provider.toUpperCase()}`;
  const envValue = process.env[envKey]?.trim();
  const parsed = envValue ? Number.parseInt(envValue, 10) : NaN;
  if (Number.isFinite(parsed) && parsed > 0 && parsed <= 500) {
    return parsed;
  }
  return DEFAULT_PROVIDER_LIMITS[provider];
}

function getProviderAcquireTimeoutMs() {
  const parsed = Number.parseInt(
    process.env.PROVIDER_LEASE_ACQUIRE_TIMEOUT_MS?.trim() ?? "",
    10,
  );
  if (
    Number.isFinite(parsed) &&
    parsed >= MIN_PROVIDER_ACQUIRE_TIMEOUT_MS &&
    parsed <= MAX_PROVIDER_ACQUIRE_TIMEOUT_MS
  ) {
    return parsed;
  }
  return DEFAULT_PROVIDER_ACQUIRE_TIMEOUT_MS;
}

async function cleanupExpiredLeases(provider: ProviderName) {
  await prisma.providerLease
    .updateMany({
      where: {
        providerName: provider,
        releasedAt: null,
        expiresAt: { lte: new Date() },
      },
      data: {
        releasedAt: new Date(),
      },
    })
    .catch(() => undefined);
}

// Acquires a lease with a single atomic statement instead of a serializable
// interactive transaction. Parallel runs fire several acquisitions at once,
// and interactive transactions held a pooled connection for the whole
// count+insert round trip — under load this starved the connection pool and
// surfaced as "Unable to start a transaction in the given time" while user
// requests (including page renders) queued behind it. A single INSERT..SELECT
// holds a connection only for one statement. Concurrent acquisitions may
// overshoot the limit by a request or two, which is acceptable for a rate
// limiter.
async function tryAcquireProviderLease(input: {
  provider: ProviderName;
  model: string;
  owner: ProviderLeaseOwner;
}) {
  const limit = getProviderLimit(input.provider);
  const expiresAt = new Date(Date.now() + PROVIDER_LEASE_TTL_MS);
  const id = crypto.randomUUID();
  const leaseKey = crypto.randomUUID();

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    WITH provider_lock AS (
      SELECT pg_advisory_xact_lock(hashtextextended(${input.provider}, 0))
    )
    INSERT INTO "ProviderLease"
      ("id", "providerName", "leaseKey", "ownerKind", "ownerId", "model", "expiresAt", "createdAt", "updatedAt")
    SELECT
      ${id}, ${input.provider}, ${leaseKey}, ${input.owner.ownerKind},
      ${input.owner.ownerId}, ${input.model}, ${expiresAt}, now(), now()
    FROM provider_lock
    WHERE (
      SELECT count(*)
      FROM "ProviderLease"
      WHERE "providerName" = ${input.provider}
        AND "releasedAt" IS NULL
        AND "expiresAt" > now()
    ) < ${limit}
    RETURNING "id"
  `;

  return rows[0] ?? null;
}

export async function acquireProviderLease(input: {
  provider: ProviderName;
  model: string;
  owner: ProviderLeaseOwner;
  abortSignal?: AbortSignal;
}) {
  if (Math.random() < LEASE_CLEANUP_PROBABILITY) {
    await cleanupExpiredLeases(input.provider);
  }

  const timeoutMs = getProviderAcquireTimeoutMs();
  const deadline = Date.now() + timeoutMs;
  while (true) {
    if (input.abortSignal?.aborted) {
      throw input.abortSignal.reason ?? new Error("The operation was aborted.");
    }

    const lease = await tryAcquireProviderLease(input);
    if (lease) {
      return lease;
    }
    if (Date.now() >= deadline) {
      throw new ProviderLeaseCapacityTimeoutError(input.provider, timeoutMs);
    }
    await delay(
      Math.min(PROVIDER_WAIT_MS, Math.max(1, deadline - Date.now())),
      input.abortSignal,
    );
  }
}

export async function releaseProviderLease(leaseId: string) {
  await prisma.providerLease.updateMany({
    where: {
      id: leaseId,
      releasedAt: null,
    },
    data: {
      releasedAt: new Date(),
    },
  });
}
