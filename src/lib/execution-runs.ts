import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { WorkflowControlInput } from "@/lib/ai/types";
import type { UsageCheckContext } from "@/lib/usage-policy";
import type { RunWorkbenchInput } from "@/lib/validation";

export type SerializedUsageCheckContext = {
  policy: Omit<UsageCheckContext["policy"], "resetAt"> & {
    resetAt: string;
  };
  usage: UsageCheckContext["usage"];
};

type SignedRunPayload = {
  workflowRunId: string;
  userId: string;
  mode: RunWorkbenchInput["mode"];
  createdAt: string;
};

export function serializeUsageCheckContext(
  context: UsageCheckContext,
): SerializedUsageCheckContext {
  return {
    policy: {
      ...context.policy,
      resetAt: context.policy.resetAt.toISOString(),
    },
    usage: context.usage,
  };
}

export function deserializeUsageCheckContext(
  context: SerializedUsageCheckContext,
): UsageCheckContext {
  return {
    policy: {
      ...context.policy,
      resetAt: new Date(context.policy.resetAt),
    },
    usage: context.usage,
  };
}

function calculateRepeatedTotal(
  steps: Array<{ orderIndex: number }>,
  workflowControl?: WorkflowControlInput,
) {
  if (!steps.length) {
    return 0;
  }

  const repeat = workflowControl?.repeat;
  if (!repeat?.enabled) {
    return steps.length;
  }

  const startIndex = repeat.startStepOrder - 1;
  const endIndex = repeat.endStepOrder - 1;
  if (
    startIndex < 0 ||
    endIndex < 0 ||
    startIndex >= steps.length ||
    endIndex >= steps.length ||
    startIndex > endIndex
  ) {
    return steps.length;
  }

  const repeatedLength = endIndex - startIndex + 1;
  const prefix = startIndex;
  const suffix = steps.length - endIndex - 1;
  return prefix + repeatedLength * repeat.repeatCount + suffix;
}

export function calculatePlannedExecutionTotal(
  input: Pick<
    RunWorkbenchInput,
    "mode" | "targets" | "steps" | "workflowControl"
  >,
) {
  if (input.mode === "parallel") {
    return input.targets?.length ?? 0;
  }

  return calculateRepeatedTotal(input.steps ?? [], input.workflowControl);
}

function getRunTokenSecret() {
  const secret = process.env.APP_SECRET?.trim();
  if (!secret) {
    throw new Error("APP_SECRET is required to sign durable run tokens.");
  }
  return secret;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function createSignedRunToken(payload: SignedRunPayload) {
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", getRunTokenSecret())
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

export function readSignedRunToken(token: string): SignedRunPayload {
  const [encodedPayload, encodedSignature] = token.split(".");
  if (!encodedPayload || !encodedSignature) {
    throw new Error("Run token is invalid.");
  }

  const expectedSignature = createHmac("sha256", getRunTokenSecret())
    .update(encodedPayload)
    .digest("base64url");

  const received = Buffer.from(encodedSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  ) {
    throw new Error("Run token signature is invalid.");
  }

  return JSON.parse(decodeBase64Url(encodedPayload)) as SignedRunPayload;
}
