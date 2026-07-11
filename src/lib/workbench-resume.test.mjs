import test from "node:test";
import assert from "node:assert/strict";

import {
  buildWorkbenchSessionSearch,
  canAutoResumeFromSearch,
  pickLatestActiveSessionId,
  resolveWorkbenchEntryAction,
  shouldRevalidateWorkbenchOnPageResume,
} from "./workbench-resume.ts";

test("pickLatestActiveSessionId returns the newest active session", () => {
  const activeSessionId = pickLatestActiveSessionId([
    {
      id: "session-complete",
      executionRuns: [{ status: "completed" }],
    },
    {
      id: "session-active",
      executionRuns: [{ status: "running" }],
    },
    {
      id: "session-older-active",
      executionRuns: [{ status: "queued" }],
    },
  ]);

  assert.equal(activeSessionId, "session-active");
});

test("pickLatestActiveSessionId ignores sessions without an active run", () => {
  const activeSessionId = pickLatestActiveSessionId([
    {
      id: "session-complete",
      executionRuns: [{ status: "completed" }],
    },
    {
      id: "session-failed",
      executionRuns: [{ status: "failed" }],
    },
  ]);

  assert.equal(activeSessionId, null);
});

test("buildWorkbenchSessionSearch preserves other params and writes the session id", () => {
  const nextSearch = buildWorkbenchSessionSearch(
    "?project=proj-1&trial=true&new=1",
    "session-42",
  );

  assert.equal(nextSearch, "?project=proj-1&trial=true&session=session-42");
});

test("buildWorkbenchSessionSearch removes the session param when cleared", () => {
  const nextSearch = buildWorkbenchSessionSearch(
    "?project=proj-1&session=session-42",
    null,
  );

  assert.equal(nextSearch, "?project=proj-1");
});

test("canAutoResumeFromSearch only allows bare workbench entries", () => {
  assert.equal(canAutoResumeFromSearch(""), true);
  assert.equal(canAutoResumeFromSearch("?preset=starter"), true);
  assert.equal(canAutoResumeFromSearch("?session=session-42"), false);
  assert.equal(canAutoResumeFromSearch("?project=proj-1"), false);
  assert.equal(canAutoResumeFromSearch("?new=1"), false);
});

test("resolveWorkbenchEntryAction prefers an active server run over a local draft", () => {
  const action = resolveWorkbenchEntryAction({
    loadId: null,
    projectId: null,
    forceNew: false,
    hasDraft: true,
    latestActiveSessionId: "session-active",
  });

  assert.deepEqual(action, {
    kind: "resume-session",
    sessionId: "session-active",
  });
});

test("resolveWorkbenchEntryAction preserves an explicit session selection", () => {
  const action = resolveWorkbenchEntryAction({
    loadId: "session-explicit",
    projectId: "proj-1",
    forceNew: false,
    hasDraft: true,
    latestActiveSessionId: "session-active",
  });

  assert.deepEqual(action, {
    kind: "load-session",
    sessionId: "session-explicit",
  });
});

test("resolveWorkbenchEntryAction honors forceNew before active session recovery", () => {
  const action = resolveWorkbenchEntryAction({
    loadId: null,
    projectId: null,
    forceNew: true,
    hasDraft: true,
    latestActiveSessionId: "session-active",
  });

  assert.deepEqual(action, { kind: "new-session" });
});

test("shouldRevalidateWorkbenchOnPageResume rechecks active runs and loaded sessions", () => {
  assert.equal(
    shouldRevalidateWorkbenchOnPageResume({
      activeRunId: "signed-run",
      sessionId: null,
    }),
    true,
  );
  assert.equal(
    shouldRevalidateWorkbenchOnPageResume({
      activeRunId: null,
      sessionId: "session-1",
    }),
    true,
  );
  assert.equal(
    shouldRevalidateWorkbenchOnPageResume({
      activeRunId: null,
      sessionId: null,
      pagePersisted: true,
    }),
    true,
  );
});
