import { NextResponse } from "next/server";
import { runExecutionRunStepWatchdog } from "@/lib/execution-run-steps";
import { verifyInternalWorkerRequest } from "@/lib/internal-worker-auth";
import {
  enqueueWorkbenchWatchdog,
  getWorkbenchWatchdogIntervalSeconds,
} from "@/lib/qstash";
import { closeStaleWorkbenchRuns } from "@/lib/workbench-run-watchdog";

export async function POST(request: Request) {
  const verified = await verifyInternalWorkerRequest(request);
  if (!verified.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [result, staleRuns] = await Promise.all([
    runExecutionRunStepWatchdog(),
    closeStaleWorkbenchRuns(),
  ]);
  if (
    ("activeRunCount" in result && result.activeRunCount > 0) ||
    staleRuns.closedCount > 0
  ) {
    await enqueueWorkbenchWatchdog(getWorkbenchWatchdogIntervalSeconds()).catch(
      () => undefined,
    );
  }
  return NextResponse.json({ ok: true, ...result, legacyStaleRuns: staleRuns });
}
