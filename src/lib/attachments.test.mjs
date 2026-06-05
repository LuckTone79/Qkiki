import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  extractAttachmentTextContent,
  listAcceptedAttachmentTypes,
  resolveAttachmentDescriptor,
} from "./attachment-files.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("listAcceptedAttachmentTypes includes docx uploads", () => {
  assert.match(listAcceptedAttachmentTypes(), /(^|,)\.docx(,|$)/);
});

test("resolveAttachmentDescriptor treats docx files as text attachments", () => {
  assert.deepEqual(
    resolveAttachmentDescriptor(
      "briefing.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ),
    {
      kind: "TEXT",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
  );
});

test("extractAttachmentTextContent reads docx body text", async () => {
  const bytes = readFileSync(path.join(__dirname, "fixtures", "sample.docx"));

  const text = await extractAttachmentTextContent({
    kind: "TEXT",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    bytes,
  });

  assert.match(text, /Quarterly revenue increased 18 percent\./);
  assert.match(text, /Focus on enterprise renewals\./);
});
