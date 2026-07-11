const ACTIVE_EXECUTION_RUN_STATUSES = new Set([
  "queued",
  "running",
  "retrying",
  "canceling",
]);

type SessionRunSummary = {
  status?: string | null;
};

type SessionListEntry = {
  id: string;
  executionRuns?: SessionRunSummary[] | null;
};

type ResolveWorkbenchEntryActionInput = {
  loadId: string | null;
  projectId: string | null;
  forceNew: boolean;
  hasDraft: boolean;
  latestActiveSessionId: string | null;
};

export type WorkbenchEntryAction =
  | { kind: "new-session" }
  | { kind: "load-session"; sessionId: string }
  | { kind: "load-project"; projectId: string }
  | { kind: "resume-session"; sessionId: string }
  | { kind: "restore-draft" }
  | { kind: "restore-default" };

export function hasActiveExecutionRun(status: string | null | undefined) {
  return Boolean(status && ACTIVE_EXECUTION_RUN_STATUSES.has(status));
}

export function pickLatestActiveSessionId(
  sessions: SessionListEntry[],
): string | null {
  for (const session of sessions) {
    const latestRun = session.executionRuns?.[0];
    if (hasActiveExecutionRun(latestRun?.status)) {
      return session.id;
    }
  }

  return null;
}

export function buildWorkbenchSessionSearch(
  currentSearch: string,
  sessionId: string | null,
) {
  const params = new URLSearchParams(currentSearch);

  if (sessionId) {
    params.set("session", sessionId);
    params.delete("new");
  } else {
    params.delete("session");
  }

  const next = params.toString();
  return next ? `?${next}` : "";
}

export function canAutoResumeFromSearch(currentSearch: string) {
  const params = new URLSearchParams(currentSearch);
  return !params.get("session") && !params.get("project") && params.get("new") !== "1";
}

export function shouldRevalidateWorkbenchOnPageResume(input: {
  activeRunId: string | null;
  sessionId: string | null;
  pagePersisted?: boolean;
  visibilityState?: DocumentVisibilityState;
}) {
  return Boolean(
    input.activeRunId ||
      input.sessionId ||
      input.pagePersisted ||
      input.visibilityState === "visible",
  );
}

export function resolveWorkbenchEntryAction(
  input: ResolveWorkbenchEntryActionInput,
): WorkbenchEntryAction {
  if (input.forceNew) {
    return { kind: "new-session" };
  }

  if (input.loadId) {
    return { kind: "load-session", sessionId: input.loadId };
  }

  if (input.projectId) {
    return { kind: "load-project", projectId: input.projectId };
  }

  if (input.latestActiveSessionId) {
    return {
      kind: "resume-session",
      sessionId: input.latestActiveSessionId,
    };
  }

  if (input.hasDraft) {
    return { kind: "restore-draft" };
  }

  return { kind: "restore-default" };
}
