import "server-only";

import { Receiver } from "@upstash/qstash";
import { readBoundedRequestBody } from "@/lib/bounded-request-body";
import {
  buildInternalWorkerSignature,
  isFreshInternalWorkerTimestamp,
  isStrongInternalWorkerSecret,
  requiresQstashOnlyVerification,
  timingSafeSignatureEqual,
} from "@/lib/internal-worker-auth-core";

export const INTERNAL_WORKER_MAX_BODY_BYTES = 16 * 1024;

function getReceiver() {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY?.trim();
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY?.trim();

  if (!currentSigningKey || !nextSigningKey) {
    return null;
  }

  return new Receiver({
    currentSigningKey,
    nextSigningKey,
  });
}

function getHmacSignature(input: {
  timestamp: string;
  method: string;
  path: string;
  body: string;
}) {
  const secret = process.env.INTERNAL_WORKER_SECRET?.trim();
  if (!isStrongInternalWorkerSecret(secret)) {
    return null;
  }

  return buildInternalWorkerSignature({
    secret: secret!,
    timestamp: input.timestamp,
    method: input.method,
    path: input.path,
    body: input.body,
  });
}

async function verifyQstashSignature(request: Request, rawBody: string) {
  const receiver = getReceiver();
  const signature = request.headers.get("upstash-signature");
  if (!receiver || !signature) {
    return false;
  }

  return receiver.verify({
    signature,
    body: rawBody,
    url: request.url,
  });
}

function verifyHmacFallback(request: Request, rawBody: string) {
  // Primary headers are X-Yapp-*; legacy X-Qkiki-* are still accepted so any
  // in-flight worker request enqueued before the rebrand still verifies.
  const timestamp =
    request.headers.get("X-Yapp-Timestamp") ??
    request.headers.get("X-Qkiki-Timestamp");
  const signature =
    request.headers.get("X-Yapp-Signature") ??
    request.headers.get("X-Qkiki-Signature");

  if (!timestamp || !signature) {
    return false;
  }

  const expected = getHmacSignature({
    timestamp,
    method: request.method,
    path: new URL(request.url).pathname,
    body: rawBody,
  });

  if (!expected) {
    return false;
  }

  if (!isFreshInternalWorkerTimestamp(timestamp)) {
    return false;
  }

  return timingSafeSignatureEqual(expected, signature);
}

export async function verifyInternalWorkerRequest(request: Request) {
  const boundedBody = await readBoundedRequestBody(
    request,
    INTERNAL_WORKER_MAX_BODY_BYTES,
  );
  if (!boundedBody.ok) {
    return {
      ok: false as const,
      status: 413 as const,
      bodyText: "",
    };
  }

  const rawBody = boundedBody.bodyText;
  const qstashOnly = requiresQstashOnlyVerification({
    nodeEnv: process.env.NODE_ENV,
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
  });

  try {
    if (await verifyQstashSignature(request, rawBody)) {
      return {
        ok: true as const,
        verificationMethod: "qstash" as const,
        bodyText: rawBody,
      };
    }
  } catch {
    if (qstashOnly) {
      return {
        ok: false as const,
        status: 401 as const,
        bodyText: "",
      };
    }
  }

  // A production deployment with either QStash signing key configured must
  // never downgrade to the custom HMAC path. Partial or invalid key rotation
  // configuration therefore fails closed as well.
  if (qstashOnly) {
    return {
      ok: false as const,
      status: 401 as const,
      bodyText: "",
    };
  }

  if (verifyHmacFallback(request, rawBody)) {
    return {
      ok: true as const,
      verificationMethod: "hmac" as const,
      bodyText: rawBody,
    };
  }

  return {
    ok: false as const,
    status: 401 as const,
    bodyText: "",
  };
}
