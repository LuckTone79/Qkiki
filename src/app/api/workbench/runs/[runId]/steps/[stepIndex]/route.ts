import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiGenerationUser } from "@/lib/api-auth";
import { cancelExecutionRunStepV2 } from "@/lib/execution-run-steps";
import {
  MAX_STEP_STOP_INDEX,
  getExecutionRunForUser,
  readSignedRunToken,
  requestExecutionRunStepStop,
} from "@/lib/execution-runs";

type RouteContext = {
  params: Promise<{ runId: string; stepIndex: string }>;
};

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const user = await requireApiGenerationUser();
    const { runId, stepIndex: rawStepIndex } = await params;
    let token;

    try {
      token = readSignedRunToken(decodeURIComponent(runId));
    } catch {
      return NextResponse.json({ error: "Run not found." }, { status: 404 });
    }

    if (token.userId !== user.id || !("executionRunId" in token)) {
      return NextResponse.json({ error: "Run not found." }, { status: 404 });
    }

    if (token.mode !== "sequential") {
      return NextResponse.json(
        { error: "Step stop is only available for sequential runs." },
        { status: 400 },
      );
    }

    const stepIndex = Number.parseInt(rawStepIndex, 10);
    if (
      !Number.isInteger(stepIndex) ||
      stepIndex < 0 ||
      stepIndex > MAX_STEP_STOP_INDEX
    ) {
      return NextResponse.json(
        { error: "Step index is out of bounds." },
        { status: 400 },
      );
    }

    const executionRun = await getExecutionRunForUser({
      executionRunId: token.executionRunId,
      userId: user.id,
    });

    if (!executionRun) {
      return NextResponse.json({ error: "Run not found." }, { status: 404 });
    }

    if (executionRun.runnerVersion === "v2") {
      const stoppedStep = await cancelExecutionRunStepV2({
        executionRunId: token.executionRunId,
        userId: user.id,
        orderIndex: stepIndex,
      });

      if (!stoppedStep) {
        return NextResponse.json({ error: "Run not found." }, { status: 404 });
      }

      if (stoppedStep.status === "running") {
        return NextResponse.json(
          {
            error: "A running V2 step cannot be force-stopped yet. Use the full run cancel action.",
          },
          { status: 409 },
        );
      }

      return NextResponse.json({
        ok: true,
        runId,
        executionRunId: token.executionRunId,
        stepIndex,
        status: stoppedStep.status,
      });
    }

    const stoppedLegacyRun = await requestExecutionRunStepStop({
      executionRunId: token.executionRunId,
      userId: user.id,
      stepIndex,
    });

    if (!stoppedLegacyRun) {
      return NextResponse.json({ error: "Run not found." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      runId,
      executionRunId: stoppedLegacyRun.id,
      stepIndex,
      status: stoppedLegacyRun.status,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
