import test from "node:test";
import assert from "node:assert/strict";

import { applyConnectionPoolDefaults } from "./prisma-url.ts";

const BASE =
  "postgresql://user:pass@host:6543/db?sslmode=require&pgbouncer=true";

function limitOf(url) {
  return new URL(url).searchParams.get("connection_limit");
}

test("connection_limit=1 is raised to the serverless default", () => {
  const result = applyConnectionPoolDefaults(`${BASE}&connection_limit=1`, {});

  assert.equal(limitOf(result), "5");
});

test("missing connection_limit gets the serverless default", () => {
  const result = applyConnectionPoolDefaults(BASE, {});

  assert.equal(limitOf(result), "5");
});

test("an explicit pool size of 2+ is respected", () => {
  const result = applyConnectionPoolDefaults(`${BASE}&connection_limit=3`, {});

  assert.equal(limitOf(result), "3");
});

test("PRISMA_CONNECTION_LIMIT overrides the URL value", () => {
  const result = applyConnectionPoolDefaults(`${BASE}&connection_limit=1`, {
    PRISMA_CONNECTION_LIMIT: "12",
  });

  assert.equal(limitOf(result), "12");
});

test("invalid URLs are returned unchanged", () => {
  assert.equal(applyConnectionPoolDefaults("not-a-url", {}), "not-a-url");
});
