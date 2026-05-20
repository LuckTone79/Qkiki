import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

async function main() {
  const runs = await prisma.executionRun.findMany({
    where: {
      runnerVersion: "v2",
      status: { in: ["queued", "running", "retrying", "canceling"] },
    },
    select: {
      id: true,
      userId: true,
      status: true,
      usageReservationId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(JSON.stringify({ apply, count: runs.length, runs }, null, 2));

  if (!apply || !runs.length) {
    return;
  }

  for (const run of runs) {
    await prisma.$transaction(async (tx) => {
      await tx.executionRunStep.updateMany({
        where: {
          executionRunId: run.id,
          status: { in: ["queued", "running", "retrying"] },
        },
        data: {
          status: "canceled",
          canceledAt: new Date(),
          errorCode: "USER_CANCELED",
          errorMessage: "시스템 업데이트로 중지됨. 다시 실행해 주세요.",
          errorRetryable: false,
          lockedBy: null,
          lockExpiresAt: null,
        },
      });

      await tx.executionRun.update({
        where: { id: run.id },
        data: {
          status: "canceled",
          errorMessage: "시스템 업데이트로 중지됨. 다시 실행해 주세요.",
          finishedAt: new Date(),
        },
      });
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
