type AiRequestUsageRow = {
  userId?: string | null;
  provider: string;
  model?: string | null;
  requests: number;
  estimatedCost: number;
  inputTokens: number;
  outputTokens: number;
};

type ResultUsageRow = {
  executionRun?: { userId: string | null } | null;
  provider: string;
  model: string;
  estimatedCost: number | null;
  tokenUsagePrompt: number | null;
  tokenUsageCompletion: number | null;
};

type UsageRow = {
  label: string;
  requests: number;
  estimatedCost: number;
  inputTokens: number;
  outputTokens: number;
};

export type AdminUserSort = "created" | "latest" | "tasks" | "credits" | "tokens";

export type AdminUserActivityBaseRow = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  lastActiveAt?: Date | null;
};

export type AdminUserUsageLogRow = {
  id: string;
  userId: string;
  requestType: string;
  selectedModels: string[];
  creditsUsed: number;
  inputTokenCount: number;
  outputTokenCount: number;
  estimatedCostUsd: number;
  createdAt: Date;
};

export type AdminUserExecutionRunRow = {
  id: string;
  userId: string;
  status: string;
  requestType: string;
  mode: string;
  totalStepsDone: number;
  totalStepsPlanned: number;
  createdAt: Date;
  updatedAt: Date;
  finishedAt: Date | null;
};

export type AdminUserRecentTask = {
  id: string;
  requestType: string;
  status: string;
  models: string[];
  creditsUsed: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  createdAt: Date;
};

export type AdminUserActivitySummary = {
  totalTaskCount: number;
  completedTaskCount: number;
  activeTaskCount: number;
  totalCreditsUsed: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalEstimatedCostUsd: number;
  lastUsageAt: Date;
  recentTasks: AdminUserRecentTask[];
};

const activeRunStatuses = new Set(["queued", "running", "retrying", "canceling"]);

function addRow(target: Map<string, UsageRow>, key: string, input: Omit<UsageRow, "label">) {
  const existing = target.get(key);
  if (existing) {
    existing.requests += input.requests;
    existing.estimatedCost += input.estimatedCost;
    existing.inputTokens += input.inputTokens;
    existing.outputTokens += input.outputTokens;
    return;
  }

  target.set(key, { label: key, ...input });
}

function latestDate(...dates: Array<Date | null | undefined>) {
  const validDates = dates.filter((date): date is Date => date instanceof Date);
  return validDates.reduce((latest, date) =>
    date.getTime() > latest.getTime() ? date : latest,
  );
}

function createEmptyUserActivitySummary(user: AdminUserActivityBaseRow) {
  return {
    totalTaskCount: 0,
    completedTaskCount: 0,
    activeTaskCount: 0,
    totalCreditsUsed: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalEstimatedCostUsd: 0,
    lastUsageAt: user.lastActiveAt ?? user.createdAt,
    recentTasks: [],
  } satisfies AdminUserActivitySummary;
}

export function buildUserActivitySummaries(input: {
  users: AdminUserActivityBaseRow[];
  usageLogs: AdminUserUsageLogRow[];
  executionRuns: AdminUserExecutionRunRow[];
  recentTaskLimit?: number;
}) {
  const summaries = new Map<string, AdminUserActivitySummary>();
  const usageLogCounts = new Map<string, number>();
  const executionRunCounts = new Map<string, number>();
  const completedExecutionRunCounts = new Map<string, number>();
  const recentTaskLimit = input.recentTaskLimit ?? 3;

  for (const user of input.users) {
    summaries.set(user.id, createEmptyUserActivitySummary(user));
  }

  for (const usageLog of input.usageLogs) {
    const summary = summaries.get(usageLog.userId);
    if (!summary) {
      continue;
    }

    usageLogCounts.set(
      usageLog.userId,
      (usageLogCounts.get(usageLog.userId) ?? 0) + 1,
    );
    summary.completedTaskCount += 1;
    summary.totalCreditsUsed += usageLog.creditsUsed;
    summary.totalInputTokens += usageLog.inputTokenCount;
    summary.totalOutputTokens += usageLog.outputTokenCount;
    summary.totalEstimatedCostUsd += usageLog.estimatedCostUsd;
    summary.lastUsageAt = latestDate(summary.lastUsageAt, usageLog.createdAt);
    summary.recentTasks.push({
      id: usageLog.id,
      requestType: usageLog.requestType,
      status: "completed",
      models: usageLog.selectedModels,
      creditsUsed: usageLog.creditsUsed,
      inputTokens: usageLog.inputTokenCount,
      outputTokens: usageLog.outputTokenCount,
      estimatedCostUsd: usageLog.estimatedCostUsd,
      createdAt: usageLog.createdAt,
    });
  }

  for (const run of input.executionRuns) {
    const summary = summaries.get(run.userId);
    if (!summary) {
      continue;
    }

    executionRunCounts.set(
      run.userId,
      (executionRunCounts.get(run.userId) ?? 0) + 1,
    );
    if (activeRunStatuses.has(run.status)) {
      summary.activeTaskCount += 1;
      summary.recentTasks.push({
        id: run.id,
        requestType: run.requestType || run.mode,
        status: run.status,
        models: [],
        creditsUsed: 0,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        createdAt: run.updatedAt,
      });
    }
    if (run.status === "completed" || run.status === "partial") {
      completedExecutionRunCounts.set(
        run.userId,
        (completedExecutionRunCounts.get(run.userId) ?? 0) + 1,
      );
    }
    summary.lastUsageAt = latestDate(
      summary.lastUsageAt,
      run.finishedAt,
      run.updatedAt,
    );
  }

  for (const [userId, summary] of summaries) {
    summary.totalTaskCount = Math.max(
      usageLogCounts.get(userId) ?? 0,
      executionRunCounts.get(userId) ?? 0,
    );
    summary.completedTaskCount = Math.max(
      usageLogCounts.get(userId) ?? 0,
      completedExecutionRunCounts.get(userId) ?? 0,
    );
    summary.recentTasks = summary.recentTasks
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, recentTaskLimit);
  }

  return summaries;
}

export function sortUserActivitySummaries<T extends AdminUserActivityBaseRow>(
  users: T[],
  summaries: Map<string, AdminUserActivitySummary>,
  sort: AdminUserSort,
) {
  return [...users].sort((left, right) => {
    const leftSummary = summaries.get(left.id) ?? createEmptyUserActivitySummary(left);
    const rightSummary =
      summaries.get(right.id) ?? createEmptyUserActivitySummary(right);

    const value = (() => {
      if (sort === "latest") {
        return rightSummary.lastUsageAt.getTime() - leftSummary.lastUsageAt.getTime();
      }
      if (sort === "tasks") {
        return rightSummary.totalTaskCount - leftSummary.totalTaskCount;
      }
      if (sort === "credits") {
        return rightSummary.totalCreditsUsed - leftSummary.totalCreditsUsed;
      }
      if (sort === "tokens") {
        return (
          rightSummary.totalInputTokens +
          rightSummary.totalOutputTokens -
          (leftSummary.totalInputTokens + leftSummary.totalOutputTokens)
        );
      }
      return right.createdAt.getTime() - left.createdAt.getTime();
    })();

    if (value !== 0) {
      return value;
    }

    return left.email.localeCompare(right.email);
  });
}

export function mergeProviderUsageRows(input: {
  aiRequests: AiRequestUsageRow[];
  orphanResults: ResultUsageRow[];
}) {
  const rows = new Map<string, UsageRow>();

  for (const request of input.aiRequests) {
    addRow(rows, request.provider, {
      requests: request.requests,
      estimatedCost: request.estimatedCost,
      inputTokens: request.inputTokens,
      outputTokens: request.outputTokens,
    });
  }

  for (const result of input.orphanResults) {
    addRow(rows, result.provider, {
      requests: 1,
      estimatedCost: result.estimatedCost ?? 0,
      inputTokens: result.tokenUsagePrompt ?? 0,
      outputTokens: result.tokenUsageCompletion ?? 0,
    });
  }

  return [...rows.values()].sort((a, b) => b.requests - a.requests);
}

export function mergeModelUsageRows(input: {
  aiRequests: AiRequestUsageRow[];
  orphanResults: ResultUsageRow[];
  take?: number;
}) {
  const rows = new Map<string, UsageRow>();

  for (const request of input.aiRequests) {
    addRow(rows, `${request.provider}/${request.model ?? ""}`, {
      requests: request.requests,
      estimatedCost: request.estimatedCost,
      inputTokens: request.inputTokens,
      outputTokens: request.outputTokens,
    });
  }

  for (const result of input.orphanResults) {
    addRow(rows, `${result.provider}/${result.model}`, {
      requests: 1,
      estimatedCost: result.estimatedCost ?? 0,
      inputTokens: result.tokenUsagePrompt ?? 0,
      outputTokens: result.tokenUsageCompletion ?? 0,
    });
  }

  return [...rows.values()]
    .sort((a, b) => b.requests - a.requests)
    .slice(0, input.take ?? 10);
}

export function mergeUserCostRows(input: {
  aiRequests: AiRequestUsageRow[];
  orphanResults: ResultUsageRow[];
  usersById: Map<string, { email: string | null; name: string | null }>;
  take: number;
  includeTokens: boolean;
}) {
  const rows = new Map<string, UsageRow>();

  for (const request of input.aiRequests) {
    if (!request.userId) {
      continue;
    }
    addRow(rows, request.userId, {
      requests: request.requests,
      estimatedCost: request.estimatedCost,
      inputTokens: input.includeTokens ? request.inputTokens : 0,
      outputTokens: input.includeTokens ? request.outputTokens : 0,
    });
  }

  for (const result of input.orphanResults) {
    const userId = result.executionRun?.userId;
    if (!userId) {
      continue;
    }
    addRow(rows, userId, {
      requests: 1,
      estimatedCost: result.estimatedCost ?? 0,
      inputTokens: input.includeTokens ? result.tokenUsagePrompt ?? 0 : 0,
      outputTokens: input.includeTokens ? result.tokenUsageCompletion ?? 0 : 0,
    });
  }

  return [...rows.entries()]
    .map(([userId, row]) => {
      const user = input.usersById.get(userId);
      return {
        ...row,
        label: user?.name || user?.email || "Unknown user",
      };
    })
    .sort((a, b) => b.estimatedCost - a.estimatedCost)
    .slice(0, input.take);
}
