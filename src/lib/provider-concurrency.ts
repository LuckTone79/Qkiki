import "server-only";

import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import type { ProviderName } from "@/lib/ai/types";
import { prisma } from "@/lib/prisma";
import { isProviderLeaseTransientError } from "@/lib/provider-lease-errors";

const PROVIDER_LEASE_TTL_MS = 6 * 60 * 60 * 1000;
const PROVIDER_WAIT_MS = 750;

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

function getPositiveIntegerEnv(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

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

async function withSerializableRetries<T>(
  callback: () => Promise<T>,
  retries = 3,
): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < retries) {
    try {
      return await callback();
    } catch (error) {
      const prismaCode =
        error instanceof Prisma.PrismaClientKnownRequestError
          ? error.code
          : null;
      if (prismaCode !== "P2034" && !isProviderLeaseTransientError(error)) {
        throw error;
      }
      lastError = error;
      attempt += 1;
    }
  }

  throw lastError ?? new Error("The transaction could not be completed.");
}

function getProviderLimit(provider: ProviderName) {
  const envKey = `PROVIDER_CONCURRENCY_${provider.toUpperCase()}`;
  const envValue = process.env[envKey]?.trim();
  const parsed = envValue ? Number.parseInt(envValue, 10) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_PROVIDER_LIMITS[provider];
}

async function tryAcquireProviderLease(input: {
  provider: ProviderName;
  model: string;
  owner: ProviderLeaseOwner;
}) {
  const now = new Date();
  const limit = getProviderLimit(input.provider);
  const expiresAt = new Date(now.getTime() + PROVIDER_LEASE_TTL_MS);

  return withSerializableRetries(() =>
    prisma.$transaction(
      async (tx) => {
        await tx.providerLease.updateMany({
          where: {
            providerName: input.provider,
            releasedAt: null,
            expiresAt: { lte: now },
          },
          data: {
            releasedAt: now,
          },
        });

        const activeCount = await tx.providerLease.count({
          where: {
            providerName: input.provider,
            releasedAt: null,
            expiresAt: { gt: now },
          },
        });

        if (activeCount >= limit) {
          return null;
        }

        return tx.providerLease.create({
          data: {
            providerName: input.provider,
            leaseKey: crypto.randomUUID(),
            ownerKind: input.owner.ownerKind,
            ownerId: input.owner.ownerId,
            model: input.model,
            expiresAt,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: getPositiveIntegerEnv(
          "PROVIDER_LEASE_TRANSACTION_MAX_WAIT_MS",
          10000,
        ),
        timeout: getPositiveIntegerEnv(
          "PROVIDER_LEASE_TRANSACTION_TIMEOUT_MS",
          10000,
        ),
      },
    ),
  );
}

export async function acquireProviderLease(input: {
  provider: ProviderName;
  model: string;
  owner: ProviderLeaseOwner;
  abortSignal?: AbortSignal;
}) {
  while (true) {
    if (input.abortSignal?.aborted) {
      throw input.abortSignal.reason ?? new Error("The operation was aborted.");
    }

    const lease = await tryAcquireProviderLease(input);
    if (lease) {
      return lease;
    }
    await delay(PROVIDER_WAIT_MS, input.abortSignal);
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
