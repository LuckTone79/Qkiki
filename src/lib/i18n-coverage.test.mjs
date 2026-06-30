import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

test("every application language selector exposes all four locales", () => {
  for (const relativePath of [
    "src/components/i18n/LanguageSelector.tsx",
    "src/components/AppShell.tsx",
  ]) {
    const source = read(relativePath);
    for (const language of ["en", "ko", "ja", "es"]) {
      assert.match(
        source,
        new RegExp(`<option value=["']${language}["']`),
        `${relativePath} is missing the ${language} option`,
      );
    }
  }
});

test("the guidebook has complete English, Korean, Japanese, and Spanish sections", () => {
  const source = read("src/app/guide/page.tsx");
  for (const language of ["en", "ko", "ja", "es"]) {
    assert.match(source, new RegExp(`^  ${language}:`, "m"));
  }
});

test("user-facing language consumers do not retain binary Korean-English branches", () => {
  const sourceFiles = [
    ...walk(path.join(root, "src", "app")),
    ...walk(path.join(root, "src", "components")),
    read("src/lib/workbench-model-guidance.ts")
      ? path.join(root, "src", "lib", "workbench-model-guidance.ts")
      : "",
    path.join(root, "src", "lib", "session-input-copy.ts"),
  ].filter(Boolean);

  const offenders = sourceFiles
    .filter((file) => /language\s*===\s*["']ko["']/.test(fs.readFileSync(file, "utf8")))
    .map((file) => path.relative(root, file));

  assert.deepEqual(
    offenders,
    [],
    `Binary language branches remain:\n${offenders.join("\n")}`,
  );
});
