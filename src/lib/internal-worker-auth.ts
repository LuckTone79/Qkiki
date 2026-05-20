import "server-only";

import crypto from "node:crypto";
import { Receiver } from "@upstash/qstash";

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

function bodyHash(body: string) {
  return crypto.createHash("sha256").update(body).digest("hex");
}

function getHmacSignature(input: {
  timestamp: string;
  method: string;
  path: string;
  body: string;
}) {
  const secret = process.env.INTERNAL_WORKER_SECRET?.trim();
  if (!secret) {
    return null;
  }

  const payload = [
    input.timestamp,
    input.method.toUpperCase(),
    input.path,
    bodyHash(input.body),
  ].join(".");

  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

async function verifyQstashSignature(request: Request, rawBody: string) {
  const receiver = getReceiver();
  const signature = request.headers.get("upstash-signature");
  if (!receiver || !signature) {
    return false;
  }

  await receiver.verify({
    signature,
    body: rawBody,
    url: request.url,
  });

  return true;
}

function verifyHmacFallback(request: Request, rawBody: string) {
  const timestamp = request.headers.get("X-Qkiki-Timestamp");
  const signature = request.headers.get("X-Qkiki-Signature");

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

  const ageMs = Math.abs(Date.now() - Number(timestamp));
  if (!Number.isFinite(ageMs) || ageMs > 5 * 60 * 1000) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(signature, "utf8");

  return (
    expectedBuffer.length === actualBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

export async function verifyInternalWorkerRequest(request: Request) {
  const rawBody = await request.text();

  try {
    if (await verifyQstashSignature(request, rawBody)) {
      return {
        ok: true as const,
        bodyText: rawBody,
      };
    }
  } catch {
    return {
      ok: false as const,
      bodyText: rawBody,
    };
  }

  if (verifyHmacFallback(request, rawBody)) {
    return {
      ok: true as const,
      bodyText: rawBody,
    };
  }

  return {
    ok: false as const,
    bodyText: rawBody,
  };
}
