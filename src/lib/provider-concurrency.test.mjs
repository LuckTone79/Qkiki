import test from "node:test";
import assert from "node:assert/strict";

import { isProviderLeaseTransientError } from "./provider-lease-errors.ts";

test("provider lease transient detector catches Prisma transaction start timeout", () => {
  const error = new Error(
    "Transaction API error: Unable to start a transaction in the given time.",
  );

  assert.equal(isProviderLeaseTransientError(error), true);
});

test("provider lease transient detector does not hide unrelated provider errors", () => {
  const error = new Error("google: Your prepayment credits are depleted.");

  assert.equal(isProviderLeaseTransientError(error), false);
});
