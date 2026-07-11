import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function readRoute(relativePath) {
  return readFileSync(new URL(`../app/api/admin/${relativePath}`, import.meta.url), "utf8");
}

test("critical admin endpoints require super-administrator authorization", () => {
  for (const route of [
    "audit-logs/route.ts",
    "providers/route.ts",
    "providers/[providerName]/health-check/route.ts",
    "system/settings/route.ts",
    "users/[id]/route.ts",
    "users/[id]/grants/route.ts",
  ]) {
    assert.match(readRoute(route), /requireApiAdminCritical\(/, route);
  }
});

test("support viewers cannot mutate feedback", () => {
  assert.match(
    readRoute("feedback/[id]/route.ts"),
    /export async function PATCH[\s\S]*requireApiAdminManager\(/,
  );
  assert.match(
    readRoute("feedback/[id]/comments/route.ts"),
    /export async function POST[\s\S]*requireApiAdminManager\(/,
  );
});

