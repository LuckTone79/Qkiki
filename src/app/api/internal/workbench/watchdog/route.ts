import { NextResponse } from "next/server";
import { runExecutionRunStepWatchdog } from "@/lib/execution-run-steps";
import { verifyInternalWorkerRequest } from "@/lib/internal-worker-auth";
import {
  enqueueWorkbenchWatchdog,
  getWorkbenchWatchdogIntervalSeconds,
} from "@/lib/qstash";

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const verified = await verifyInternalWorkerRequest(request);
  if (!verified.ok) {
    return jsonResponse(
      { error: verified.status === 413 ? "Payload too large." : "Unauthorized" },
      verified.status,
    );
  }

  if (
    !request.headers.get("content-type")?.toLowerCase().startsWith("application/json") ||
    request.headers.get("x-yapp-internal-intent") !== "watchdog"
  ) {
    return jsonResponse({ error: "Invalid worker request." }, 400);
  }

  let body: unknown;
  try {
    body = JSON.parse(verified.bodyText);
  } catch {
    return jsonResponse({ error: "Invalid worker payload." }, 400);
  }

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => key !== "intent") ||
    !("intent" in body) ||
    body.intent !== "watchdog"
  ) {
    return jsonResponse({ error: "Invalid worker payload." }, 400);
  }

  const result = await runExecutionRunStepWatchdog();
  if ("activeRunCount" in result && result.activeRunCount > 0) {
    await enqueueWorkbenchWatchdog(getWorkbenchWatchdogIntervalSeconds()).catch(
      () => undefined,
    );
  }
  return jsonResponse({ ok: true, ...result });
}
