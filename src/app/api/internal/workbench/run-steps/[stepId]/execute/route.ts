import { NextResponse } from "next/server";
import { executeStepWithContinuation } from "@/lib/execution-run-steps";
import { verifyInternalWorkerRequest } from "@/lib/internal-worker-auth";

type RouteContext = {
  params: Promise<{ stepId: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const verified = await verifyInternalWorkerRequest(request);
  if (!verified.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { stepId } = await params;
  const body = verified.bodyText ? JSON.parse(verified.bodyText) as { stepId?: string } : {};
  if (body.stepId && body.stepId !== stepId) {
    return NextResponse.json({ error: "Step id mismatch." }, { status: 400 });
  }

  await executeStepWithContinuation({
    stepId,
    invocationStartedAt: Date.now(),
  });

  return NextResponse.json({ ok: true, stepId });
}
