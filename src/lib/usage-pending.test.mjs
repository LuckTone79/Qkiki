import test from "node:test";
import assert from "node:assert/strict";

import { normalizePendingUsageAggregate } from "./usage-pending.ts";

test("pending usage aggregate normalizes null database sums", () => {
  assert.deepEqual(
    normalizePendingUsageAggregate({
      _sum: { reservedRequestCount: null, reservedCreditCount: null },
    }),
    { reservedRequests: 0, reservedCredits: 0 },
  );
});

test("pending usage aggregate preserves request and credit totals", () => {
  assert.deepEqual(
    normalizePendingUsageAggregate({
      _sum: { reservedRequestCount: 3, reservedCreditCount: 17 },
    }),
    { reservedRequests: 3, reservedCredits: 17 },
  );
});
