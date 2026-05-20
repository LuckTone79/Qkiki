import { NextResponse } from "next/server";
import { runExecutionRunStepWatchdog } from "@/lib/execution-run-steps";
import { verifyInternalWorkerRequest } from "@/lib/internal-worker-auth";
import { enqueueWorkbenchWatchdog } from "@/lib/qstash";

export async function POST(request: Request) {
  const verified = await verifyInternalWorkerRequest(request);
  if (!verified.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runExecutionRunStepWatchdog();
  await enqueueWorkbenchWatchdog(60).catch(() => undefined);
  return NextResponse.json({ ok: true, ...result });
}
