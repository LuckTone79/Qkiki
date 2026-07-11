import test from "node:test";
import assert from "node:assert/strict";

async function loadNavigationModule() {
  return import("./api-auth-navigation.ts").catch(() => ({}));
}

test("expired API authentication returns sign-in path with the requested app return path", async () => {
  const navigation = await loadNavigationModule();

  assert.equal(
    navigation.resolveApiAuthRedirect?.({
      status: 401,
      returnTo: "/app/projects?create=1",
    }),
    "/sign-in?next=%2Fapp%2Fprojects%3Fcreate%3D1&reason=session_expired",
  );
});

test("API authentication redirect accepts only safe internal server redirects", async () => {
  const navigation = await loadNavigationModule();

  assert.equal(
    navigation.resolveApiAuthRedirect?.({
      status: 401,
      redirectUrl: "/sign-in?next=%2Fapp%2Fprojects",
      returnTo: "/app/projects",
    }),
    "/sign-in?next=%2Fapp%2Fprojects",
  );
  assert.equal(
    navigation.resolveApiAuthRedirect?.({
      status: 401,
      redirectUrl: "https://example.com/sign-in",
      returnTo: "/app/projects",
    }),
    "/sign-in?next=%2Fapp%2Fprojects&reason=session_expired",
  );
});

test("non-authentication API errors do not trigger a sign-in redirect", async () => {
  const navigation = await loadNavigationModule();

  assert.equal(
    navigation.resolveApiAuthRedirect?.({
      status: 500,
      returnTo: "/app/projects",
    }),
    null,
  );
});
