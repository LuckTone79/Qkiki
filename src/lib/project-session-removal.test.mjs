import assert from "node:assert/strict";
import test from "node:test";
import { removeSessionFromProject } from "./project-session-removal.ts";

function createDb({ updateCount }) {
  const calls = [];
  const transaction = {
    workbenchSession: {
      async updateMany(args) {
        calls.push(["updateMany", args]);
        return { count: updateCount };
      },
    },
    projectItem: {
      async deleteMany(args) {
        calls.push(["deleteMany", args]);
        return { count: 2 };
      },
    },
  };

  return {
    calls,
    db: {
      async $transaction(operation) {
        return operation(transaction);
      },
    },
  };
}

test("unlinks an owned session and removes its collected project items", async () => {
  const { db, calls } = createDb({ updateCount: 1 });

  const removed = await removeSessionFromProject({
    db,
    userId: "user-1",
    projectId: "project-1",
    sessionId: "session-1",
  });

  assert.equal(removed, true);
  assert.deepEqual(calls, [
    [
      "updateMany",
      {
        where: {
          id: "session-1",
          userId: "user-1",
          projectId: "project-1",
        },
        data: { projectId: null },
      },
    ],
    [
      "deleteMany",
      {
        where: {
          projectId: "project-1",
          userId: "user-1",
          sessionId: "session-1",
        },
      },
    ],
  ]);
});

test("does not remove project items when the session is not linked", async () => {
  const { db, calls } = createDb({ updateCount: 0 });

  const removed = await removeSessionFromProject({
    db,
    userId: "user-1",
    projectId: "project-1",
    sessionId: "session-2",
  });

  assert.equal(removed, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "updateMany");
});
