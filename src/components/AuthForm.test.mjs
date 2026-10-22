import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Exercise the real form submit handler without a browser or a live account.
const compiled = ts.transpileModule(
  readFileSync(new URL("./AuthForm.tsx", import.meta.url), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  },
).outputText;

function renderForm({ mode, resolutionOk = true, session = {}, authError = null }) {
  const calls = [];
  const stateChanges = [];
  const location = { href: "/sign-in", origin: "https://example.com" };
  const jsx = (type, props) => ({ type, props });
  const modules = {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    react: {
      useEffect() {},
      useState(initial) {
        return [initial, (value) => stateChanges.push(value)];
      },
    },
    "next/link": { default: "a" },
    "@/components/i18n/LanguageProvider": {
      useLanguage: () => ({ language: "en", t: (key) => key }),
      localize: (language, copy) => copy[language],
    },
    "@/components/TurnstileWidget": { TurnstileWidget: "captcha" },
    "@/lib/auth-next-path": {},
    "@/lib/browser-detection": {},
    "@/lib/wideget-login-registry": {
      getEnabledWebPrimaryLoginProviders: () => [],
    },
    "@/lib/supabase/client": {
      createSupabaseBrowserClient: () => ({
        auth: {
          async signUp() {
            calls.push("sign-up");
            return { data: { session }, error: authError };
          },
          async signInWithPassword() {
            calls.push("sign-in");
            return { error: authError };
          },
        },
      }),
    },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require(name) {
      assert.ok(name in modules, `Unexpected dependency: ${name}`);
      return modules[name];
    },
    process: { env: {} },
    window: { location },
    FormData: class {
      get(name) {
        return name === "email" ? "test@example.com" : "test-password";
      }
    },
    async fetch(url, options) {
      assert.equal(location.href, "/sign-in", "Navigation must wait for identity resolution");
      assert.equal(url, "/api/auth/resolve");
      assert.equal(options.method, "POST");
      calls.push("resolve");
      return {
        ok: resolutionOk,
        json: async () => ({ code: "IDENTITY_LINK_CONFLICT" }),
      };
    },
  });
  const form = exports.AuthForm({ mode });
  return {
    calls, stateChanges, location,
    submit: () => form.props.onSubmit({ preventDefault() {}, currentTarget: {} }),
  };
}

for (const mode of ["sign-in", "sign-up"]) {
  test(`${mode} waits for the app identity bridge before navigating`, async () => {
    const form = renderForm({ mode });
    await form.submit();
    assert.deepEqual(form.calls, [mode, "resolve"]);
    assert.equal(form.location.href, "/app/workbench");
  });

  test(`${mode} keeps identity conflicts on the form with the specific explanation`, async () => {
    const form = renderForm({ mode, resolutionOk: false });
    await form.submit();
    assert.deepEqual(form.calls, [mode, "resolve"]);
    assert.equal(form.location.href, "/sign-in");
    assert.ok(form.stateChanges.some((value) => typeof value === "string" && value.includes("already linked")));
  });
}

test("sign-up awaiting email confirmation does not resolve or navigate", async () => {
  const form = renderForm({ mode: "sign-up", session: null });
  await form.submit();
  assert.deepEqual(form.calls, ["sign-up"]);
  assert.equal(form.location.href, "/sign-in");
});

test("rejected passwords do not resolve or navigate", async () => {
  const form = renderForm({ mode: "sign-in", authError: { message: "Invalid credentials" } });
  await form.submit();
  assert.deepEqual(form.calls, ["sign-in"]);
  assert.equal(form.location.href, "/sign-in");
  assert.ok(form.stateChanges.includes("Invalid credentials"));
});
