import assert from "node:assert/strict";
import test from "node:test";
import { withoutProjectSession } from "./project-detail-state.ts";

function projectSnapshot() {
  return {
    id: "project-1",
    name: "Patent research",
    _count: { sessions: 2 },
    sessions: [
      { id: "session-1", title: "First conversation" },
      { id: "session-2", title: "Second conversation" },
    ],
  };
}

test("removes a matching project session and decrements the count", () => {
  const updated = withoutProjectSession(projectSnapshot(), "session-1");

  assert.deepEqual(
    updated.sessions.map((session) => session.id),
    ["session-2"],
  );
  assert.equal(updated._count.sessions, 1);
});

test("leaves the snapshot count unchanged when the session is absent", () => {
  const project = projectSnapshot();
  const updated = withoutProjectSession(project, "missing-session");

  assert.deepEqual(updated.sessions, project.sessions);
  assert.equal(updated._count.sessions, 2);
});

test("never decrements the project session count below zero", () => {
  const project = projectSnapshot();
  project._count.sessions = 0;

  const updated = withoutProjectSession(project, "session-1");

  assert.equal(updated._count.sessions, 0);
});

test("removes collected items that reference the unlinked session", () => {
  const project = {
    ...projectSnapshot(),
    items: [
      { id: "item-1", session: { id: "session-1" } },
      { id: "item-2", session: { id: "session-2" } },
      { id: "item-3", session: null },
    ],
  };

  const updated = withoutProjectSession(project, "session-1");

  assert.deepEqual(
    updated.items.map((item) => item.id),
    ["item-2", "item-3"],
  );
});
