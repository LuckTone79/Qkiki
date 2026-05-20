import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

async function main() {
  const orphanWorkflowSteps = await prisma.workflowStep.findMany({
    where: {
      results: { none: {} },
    },
    select: {
      id: true,
      sessionId: true,
      orderIndex: true,
      actionType: true,
    },
    orderBy: [{ sessionId: "asc" }, { orderIndex: "asc" }],
  });

  const staleRunningResults = await prisma.result.findMany({
    where: {
      status: "running",
    },
    select: {
      id: true,
      executionRunId: true,
      workflowStepId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const runningRunsWithoutActiveSteps = await prisma.executionRun.findMany({
    where: {
      status: "running",
      steps: { none: { status: { in: ["queued", "running", "retrying"] } } },
    },
    select: {
      id: true,
      status: true,
    },
  });

  const legacyResultsWithoutRunSteps = await prisma.result.findMany({
    where: {
      executionOrder: { not: null },
      executionRunId: { not: null },
      executionRunStep: null,
    },
    select: {
      id: true,
      executionRunId: true,
      executionOrder: true,
    },
    orderBy: [{ executionRunId: "asc" }, { executionOrder: "asc" }],
  });

  const report = {
    apply,
    orphanWorkflowSteps,
    staleRunningResults,
    runningRunsWithoutActiveSteps,
    legacyResultsWithoutRunSteps,
  };

  console.log(JSON.stringify(report, null, 2));

  if (!apply) {
    return;
  }

  for (const result of staleRunningResults) {
    await prisma.result.update({
      where: { id: result.id },
      data: {
        status: "failed",
        errorMessage: "Legacy running result cleaned up by maintenance script.",
      },
    });
  }

  for (const run of runningRunsWithoutActiveSteps) {
    await prisma.executionRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        errorMessage: "Legacy running execution cleaned up by maintenance script.",
        finishedAt: new Date(),
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
