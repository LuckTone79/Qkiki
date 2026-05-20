import "server-only";

import { Client } from "@upstash/qstash";

let cachedClient: Client | null = null;

export function getAppBaseUrl() {
  const baseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) {
    throw new Error("APP_BASE_URL or NEXT_PUBLIC_APP_URL is required.");
  }
  return baseUrl.replace(/\/$/, "");
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

export async function enqueueExecutionRunStep(stepId: string, delaySeconds = 0) {
  const client = getQstashClient();
  const baseUrl = getAppBaseUrl();

  await client.publishJSON({
    url: `${baseUrl}/api/internal/workbench/run-steps/${stepId}/execute`,
    body: { stepId },
    delay: delaySeconds,
    headers: {
      "X-Qkiki-Internal-Intent": "execute-run-step",
    },
  });
}

export async function enqueueWorkbenchWatchdog(delaySeconds = 60) {
  const client = getQstashClient();
  const baseUrl = getAppBaseUrl();

  await client.publishJSON({
    url: `${baseUrl}/api/internal/workbench/watchdog`,
    body: { intent: "watchdog" },
    delay: delaySeconds,
    headers: {
      "X-Qkiki-Internal-Intent": "watchdog",
    },
  });
}
