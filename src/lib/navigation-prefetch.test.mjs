import test from "node:test";
import assert from "node:assert/strict";

import {
  isIntentPrefetchHref,
  prefetchOnIntent,
} from "./navigation-prefetch.ts";

test("prefetchOnIntent prefetches internal app navigation targets", () => {
  const calls = [];
  const router = {
    prefetch(href) {
      calls.push(href);
    },
  };

  assert.equal(isIntentPrefetchHref("/app/workbench?session=session_123"), true);
  assert.equal(isIntentPrefetchHref("/app/projects/project_123"), true);

  prefetchOnIntent(router, "/app/workbench?session=session_123");
  prefetchOnIntent(router, "/app/projects/project_123");

  assert.deepEqual(calls, [
    "/app/workbench?session=session_123",
    "/app/projects/project_123",
  ]);
});

test("prefetchOnIntent ignores external or unsafe targets", () => {
  const calls = [];
  const router = {
    prefetch(href) {
      calls.push(href);
    },
  };

  assert.equal(isIntentPrefetchHref("https://example.com/app/projects/1"), false);
  assert.equal(isIntentPrefetchHref("//example.com/app/projects/1"), false);
  assert.equal(isIntentPrefetchHref("javascript:alert(1)"), false);

  prefetchOnIntent(router, "https://example.com/app/projects/1");
  prefetchOnIntent(router, "//example.com/app/projects/1");
  prefetchOnIntent(router, "javascript:alert(1)");

  assert.deepEqual(calls, []);
});
