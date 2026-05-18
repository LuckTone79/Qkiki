import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiGenerationUser } from "@/lib/api-auth";
import {
  MAX_STEP_STOP_INDEX,
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

    const executionRun = await requestExecutionRunStepStop({
      executionRunId: token.executionRunId,
      userId: user.id,
      stepIndex,
    });

    if (!executionRun) {
      return NextResponse.json({ error: "Run not found." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      runId,
      executionRunId: executionRun.id,
      stepIndex,
      status: executionRun.status,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
