import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
import ts from "typescript";

const compiled = ts.transpileModule(
  readFileSync(new URL("./route.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } },
).outputText;

function loadRoute({ currentUser = null, existing = null, ip = "192.0.2.1" } = {}) {
  const issuedSessions = [];
  let lookups = 0;
  let createdUsers = 0;
  const modules = {
    crypto,
    "next/server": {
      NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) },
    },
    "@/lib/access-policy": {
      buildTrialLoginRedirect: () => "/sign-in?reason=trial_login_required",
      getRequestIp: () => ip,
      hashIpAddress: () => "shared-network-hash",
      TRIAL_SESSION_HOURS: 24,
    },
    "@/lib/canonical-host": { buildCanonicalRedirectUrl: () => null },
    "@/lib/auth": {
      getCurrentUser: async () => currentUser,
      hashPassword: async () => "random-password-hash",
      createAuthSession: async (id) => issuedSessions.push(id),
    },
    "@/lib/prisma": {
      prisma: {
        trialAccess: { findUnique: async () => { lookups++; return existing; } },
        $transaction: async (callback) => callback({
          user: { create: async () => { createdUsers++; return { id: "new-visitor" }; } },
          trialAccess: { create: async () => ({}) },
        }),
      },
    },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require(name) {
      assert.ok(name in modules, `Unexpected dependency: ${name}`);
      return modules[name];
    },
  });
  return {
    post: () => exports.POST({ url: "https://example.com/api/trial/start" }),
    issuedSessions,
    get lookups() { return lookups; },
    get createdUsers() { return createdUsers; },
  };
}

test("a shared IP cannot issue another visitor's trial session", async () => {
  const route = loadRoute({ existing: { trialUserId: "another-visitor" } });
  const response = await route.post();
  assert.equal(response.status, 401);
  assert.match(response.body.redirectUrl, /^\/sign-in\?/);
  assert.deepEqual(route.issuedSessions, []);
  assert.equal(route.createdUsers, 0);
});

test("an existing authenticated trial keeps its own session without an IP lookup", async () => {
  const route = loadRoute({ currentUser: { id: "own-visitor", isTrial: true } });
  const response = await route.post();
  assert.equal(response.status, 200);
  assert.equal(response.body.redirectUrl, "/app/workbench?trial=true");
  assert.equal(route.lookups, 0);
  assert.deepEqual(route.issuedSessions, []);
});

test("a new network receives a newly created trial account", async () => {
  const route = loadRoute();
  const response = await route.post();
  assert.equal(response.status, 200);
  assert.equal(route.createdUsers, 1);
  assert.deepEqual(route.issuedSessions, ["new-visitor"]);
});

test("missing network information cannot issue a trial session", async () => {
  const route = loadRoute({ ip: null });
  assert.equal((await route.post()).status, 401);
  assert.equal(route.lookups, 0);
  assert.deepEqual(route.issuedSessions, []);
});
