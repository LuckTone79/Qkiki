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
