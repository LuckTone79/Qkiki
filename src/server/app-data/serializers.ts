export type SessionListDataItem = {
  id: string;
  title: string;
  originalInput: string;
  mode: string;
  createdAt: string;
  updatedAt: string;
  project: { id: string; name: string } | null;
  _count: { results: number; workflowSteps: number };
  executionRuns: Array<{
    id: string;
    mode: string;
    status: string;
    totalStepsPlanned: number;
    totalStepsDone: number;
    finalResultId: string | null;
    updatedAt: string;
  }>;
};

export type ProjectListDataItem = {
  id: string;
  name: string;
  description: string | null;
  sharedContext: string | null;
  updatedAt: string;
  _count: { sessions: number };
  sessions: Array<{
    id: string;
    title: string;
    updatedAt: string;
    _count: { results: number };
  }>;
};

export type PresetListDataItem = {
  id: string;
  name: string;
  description: string | null;
  workflowJson: string;
  updatedAt: string;
};

type SessionListRawItem = Omit<
  SessionListDataItem,
  "createdAt" | "updatedAt" | "executionRuns"
> & {
  createdAt: Date;
  updatedAt: Date;
  executionRuns: Array<
    Omit<SessionListDataItem["executionRuns"][number], "updatedAt"> & {
      updatedAt: Date;
    }
  >;
};

type ProjectListRawItem = Omit<
  ProjectListDataItem,
  "updatedAt" | "sessions"
> & {
  updatedAt: Date;
  sessions: Array<
    Omit<ProjectListDataItem["sessions"][number], "updatedAt"> & {
      updatedAt: Date;
    }
  >;
};

type PresetListRawItem = Omit<PresetListDataItem, "updatedAt"> & {
  updatedAt: Date;
};

export function serializeSessionListItem(
  item: SessionListRawItem,
): SessionListDataItem {
  return {
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    executionRuns: item.executionRuns.map((run) => ({
      ...run,
      updatedAt: run.updatedAt.toISOString(),
    })),
  };
}

export function serializeProjectListItem(
  item: ProjectListRawItem,
): ProjectListDataItem {
  return {
    ...item,
    updatedAt: item.updatedAt.toISOString(),
    sessions: item.sessions.map((session) => ({
      ...session,
      updatedAt: session.updatedAt.toISOString(),
    })),
  };
}

export function serializePresetListItem(
  item: PresetListRawItem,
): PresetListDataItem {
  return {
    ...item,
    updatedAt: item.updatedAt.toISOString(),
  };
}
