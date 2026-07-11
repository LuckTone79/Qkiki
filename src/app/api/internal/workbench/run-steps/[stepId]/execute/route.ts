import { NextResponse } from "next/server";
import { executeStepWithContinuation } from "@/lib/execution-run-steps";
import { verifyInternalWorkerRequest } from "@/lib/internal-worker-auth";

type RouteContext = {
  params: Promise<{ stepId: string }>;
};

const INTERNAL_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request, { params }: RouteContext) {
  const verified = await verifyInternalWorkerRequest(request);
  if (!verified.ok) {
    return jsonResponse(
      { error: verified.status === 413 ? "Payload too large." : "Unauthorized" },
      verified.status,
    );
  }

  const { stepId } = await params;
  if (!INTERNAL_ID_PATTERN.test(stepId)) {
    return jsonResponse({ error: "Invalid step id." }, 400);
  }

  if (
    !request.headers.get("content-type")?.toLowerCase().startsWith("application/json") ||
    request.headers.get("x-yapp-internal-intent") !== "execute-run-step"
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
    Object.keys(body).some((key) => key !== "stepId") ||
    !("stepId" in body) ||
    typeof body.stepId !== "string" ||
    body.stepId !== stepId
  ) {
    return jsonResponse({ error: "Step id mismatch." }, 400);
  }

  await executeStepWithContinuation({
    stepId,
    invocationStartedAt: Date.now(),
  });

  return jsonResponse({ ok: true, stepId });
}
