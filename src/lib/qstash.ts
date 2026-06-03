import "server-only";

import crypto from "node:crypto";
import { Client } from "@upstash/qstash";

let cachedClient: Client | null = null;

type SequentialRunnerReadiness = {
  ok: boolean;
  missing: string[];
  message: string | null;
};

export function getAppBaseUrl() {
  const baseUrl = process.env.APP_BASE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!baseUrl) {
    throw new Error("APP_BASE_URL or NEXT_PUBLIC_APP_URL is required.");
  }
  return baseUrl.replace(/\/$/, "");
}

function getInternalWorkerSecret() {
  const secret = process.env.INTERNAL_WORKER_SECRET?.trim();
  if (!secret) {
    throw new Error("INTERNAL_WORKER_SECRET is required for the V2 sequential runner.");
  }
  return secret;
}

export function getQstashClient() {
  const token = process.env.QSTASH_TOKEN?.trim();
  if (!token) {
    throw new Error("QSTASH_TOKEN is required for the V2 sequential runner.");
  }

  if (!cachedClient) {
    cachedClient = new Client({ token });
  }

  return cachedClient;
}

export function canUseQstash() {
  return Boolean(process.env.QSTASH_TOKEN?.trim());
}

export function getSequentialRunnerReadiness(): SequentialRunnerReadiness {
  const missing: string[] = [];

  if (!process.env.QSTASH_TOKEN?.trim()) {
    missing.push("QSTASH_TOKEN");
  }

  if (!(process.env.APP_BASE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim())) {
    missing.push("APP_BASE_URL");
  }

  if (!process.env.INTERNAL_WORKER_SECRET?.trim()) {
    missing.push("INTERNAL_WORKER_SECRET");
  }

  return {
    ok: missing.length === 0,
    missing,
    message:
      missing.length > 0
        ? `The V2 sequential runner is not ready. Missing: ${missing.join(", ")}.`
        : null,
  };
}

export function getWorkbenchWatchdogIntervalSeconds() {
  const parsed = Number.parseInt(
    process.env.WORKBENCH_WATCHDOG_INTERVAL_SECONDS || "180",
    10,
  );
  return Number.isFinite(parsed) && parsed >= 60 ? parsed : 180;
}

export function isQstashDailyRateLimitError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: unknown }).status === 429 &&
    error instanceof Error &&
    /daily rate limit|rate limit/i.test(error.message)
  );
}

export function getQstashRateLimitResetAt(error: unknown) {
  if (!isQstashDailyRateLimitError(error)) {
    return null;
  }

  const reset = (error as { reset?: unknown }).reset;
  const resetSeconds =
    typeof reset === "string" ? Number.parseInt(reset, 10) : Number(reset);
  if (!Number.isFinite(resetSeconds) || resetSeconds <= 0) {
    return null;
  }

  return new Date(resetSeconds * 1000);
}

function buildInternalWorkerHeaders(input: {
  path: string;
  body: string;
}) {
  const timestamp = String(Date.now());
  const secret = getInternalWorkerSecret();
  const bodyHash = crypto.createHash("sha256").update(input.body).digest("hex");
  const payload = [timestamp, "POST", input.path, bodyHash].join(".");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  return {
    "X-Qkiki-Timestamp": timestamp,
    "X-Qkiki-Signature": signature,
  };
}

export async function enqueueExecutionRunStep(stepId: string, delaySeconds = 0) {
  const client = getQstashClient();
  const baseUrl = getAppBaseUrl();
  const path = `/api/internal/workbench/run-steps/${stepId}/execute`;
  const body = { stepId };
  const bodyText = JSON.stringify(body);

  await client.publishJSON({
    url: `${baseUrl}${path}`,
    body,
    delay: delaySeconds,
    headers: {
      "X-Qkiki-Internal-Intent": "execute-run-step",
      ...buildInternalWorkerHeaders({
        path,
        body: bodyText,
      }),
    },
  });
}

export async function enqueueWorkbenchWatchdog(
  delaySeconds = getWorkbenchWatchdogIntervalSeconds(),
) {
  const client = getQstashClient();
  const baseUrl = getAppBaseUrl();
  const path = "/api/internal/workbench/watchdog";
  const body = { intent: "watchdog" };
  const bodyText = JSON.stringify(body);

  await client.publishJSON({
    url: `${baseUrl}${path}`,
    body,
    delay: delaySeconds,
    headers: {
      "X-Qkiki-Internal-Intent": "watchdog",
      ...buildInternalWorkerHeaders({
        path,
        body: bodyText,
      }),
    },
  });
}
