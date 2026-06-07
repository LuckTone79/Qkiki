import test from "node:test";
import assert from "node:assert/strict";

import { nextProviderSelectionForEnabledChange } from "./workbench-provider-selection.ts";

test("disabling a provider clears all selected child models", () => {
  assert.deepEqual(
    nextProviderSelectionForEnabledChange(
      { enabled: true, models: ["gpt-5.5", "gpt-5.4-mini"] },
      "gpt-5.4-mini",
      false,
    ),
    { enabled: false, models: [] },
  );
});

test("enabling a provider restores the default model when no child model is selected", () => {
  assert.deepEqual(
    nextProviderSelectionForEnabledChange(
      { enabled: false, models: [] },
      "gpt-5.4-mini",
      true,
    ),
    { enabled: true, models: ["gpt-5.4-mini"] },
  );
});

test("enabling a provider preserves existing selected child models", () => {
  assert.deepEqual(
    nextProviderSelectionForEnabledChange(
      { enabled: false, models: ["gpt-5.5"] },
      "gpt-5.4-mini",
      true,
    ),
    { enabled: true, models: ["gpt-5.5"] },
  );
});
