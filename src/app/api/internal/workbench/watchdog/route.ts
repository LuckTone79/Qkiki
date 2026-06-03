import { NextResponse } from "next/server";
import { runExecutionRunStepWatchdog } from "@/lib/execution-run-steps";
import { verifyInternalWorkerRequest } from "@/lib/internal-worker-auth";
import {
  enqueueWorkbenchWatchdog,
  getWorkbenchWatchdogIntervalSeconds,
} from "@/lib/qstash";

export async function POST(request: Request) {
  const verified = await verifyInternalWorkerRequest(request);
  if (!verified.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runExecutionRunStepWatchdog();
  if ("activeRunCount" in result && result.activeRunCount > 0) {
    await enqueueWorkbenchWatchdog(getWorkbenchWatchdogIntervalSeconds()).catch(
      () => undefined,
    );
  }
  return NextResponse.json({ ok: true, ...result });
}
