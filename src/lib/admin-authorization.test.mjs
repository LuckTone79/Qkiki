import test from "node:test";
import assert from "node:assert/strict";

import { canAdminMutateUser } from "./admin-authorization.ts";

test("only a super admin can mutate another lower-privileged account", () => {
  assert.equal(
    canAdminMutateUser(
      { id: "root", role: "SUPER_ADMIN" },
      { id: "admin", role: "ADMIN" },
    ),
    true,
  );
  assert.equal(
    canAdminMutateUser(
      { id: "admin", role: "ADMIN" },
      { id: "user", role: "USER" },
    ),
    false,
  );
});

test("a super admin cannot mutate self or a peer super admin", () => {
  assert.equal(
    canAdminMutateUser(
      { id: "root", role: "SUPER_ADMIN" },
      { id: "root", role: "SUPER_ADMIN" },
    ),
    false,
  );
  assert.equal(
    canAdminMutateUser(
      { id: "root", role: "SUPER_ADMIN" },
      { id: "peer", role: "SUPER_ADMIN" },
    ),
    false,
  );
});

