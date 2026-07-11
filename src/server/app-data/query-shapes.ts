export function buildSessionListQuery(userId: string) {
  return {
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      originalInput: true,
      mode: true,
      createdAt: true,
      updatedAt: true,
      project: { select: { id: true, name: true } },
      _count: { select: { results: true, workflowSteps: true } },
      executionRuns: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: {
          id: true,
          mode: true,
          status: true,
          totalStepsPlanned: true,
          totalStepsDone: true,
          finalResultId: true,
          updatedAt: true,
        },
      },
    },
  } as const;
}

export function buildProjectListQuery(userId: string) {
  return {
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { sessions: true } },
      sessions: {
        orderBy: { updatedAt: "desc" },
        take: 3,
        select: {
          id: true,
          title: true,
          updatedAt: true,
          _count: { select: { results: true } },
        },
      },
    },
  } as const;
}

export function buildPresetListQuery(userId: string) {
  return {
    where: { userId },
    orderBy: { updatedAt: "desc" },
  } as const;
}
