import path from "node:path";
import type { AttachmentKind } from "@prisma/client";

const MAX_EXTRACTED_TEXT_LENGTH = 40000;
const WORD_DOCUMENT_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const textExtensions = new Set([".txt", ".md", ".csv", ".json", ".docx"]);
const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

function extensionOf(name: string) {
  return path.extname(name).toLowerCase();
}

function sliceExtractedText(value: string) {
  return value.trim().slice(0, MAX_EXTRACTED_TEXT_LENGTH);
}

function normalizeMimeType(fileName: string, mimeType?: string | null) {
  const normalized = mimeType?.trim().toLowerCase();
  if (normalized && normalized !== "application/octet-stream") {
    return normalized;
  }

  const extension = extensionOf(fileName);
  if (textExtensions.has(extension)) {
    if (extension === ".md") {
      return "text/markdown";
    }
    if (extension === ".csv") {
      return "text/csv";
    }
    if (extension === ".json") {
      return "application/json";
    }
    if (extension === ".docx") {
      return WORD_DOCUMENT_MIME_TYPE;
    }
    return "text/plain";
  }

  if (imageExtensions.has(extension)) {
    if (extension === ".jpg") {
      return "image/jpeg";
    }
    return `image/${extension.slice(1)}`;
  }

  if (extension === ".pdf") {
    return "application/pdf";
  }

  return normalized || "application/octet-stream";
}

function getAttachmentKind(mimeType: string, fileName: string): AttachmentKind | null {
  if (mimeType.startsWith("image/")) {
    return "IMAGE";
  }

  if (mimeType === "application/pdf" || extensionOf(fileName) === ".pdf") {
    return "PDF";
  }

  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === WORD_DOCUMENT_MIME_TYPE ||
    textExtensions.has(extensionOf(fileName))
  ) {
    return "TEXT";
  }

  return null;
}

async function extractPdfText(bytes: Uint8Array) {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: Buffer.from(bytes) });
  try {
    const result = await parser.getText();
    return sliceExtractedText(result.text || "");
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(bytes: Uint8Array) {
  try {
    const mammoth = (await import("mammoth")) as {
      extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }>;
    };
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return sliceExtractedText(result.value || "");
  } catch {
    throw new Error("This Word (.docx) file could not be read.");
  }
}

export function resolveAttachmentDescriptor(fileName: string, mimeType?: string | null) {
  const normalizedMimeType = normalizeMimeType(fileName, mimeType);
  const kind = getAttachmentKind(normalizedMimeType, fileName);

  if (!kind) {
    return null;
  }

  return {
    kind,
    mimeType: normalizedMimeType,
  };
}

export function listAcceptedAttachmentTypes() {
  return ".txt,.md,.csv,.json,.docx,.pdf,image/png,image/jpeg,image/webp,image/gif";
}

export async function extractAttachmentTextContent(input: {
  kind: AttachmentKind;
  mimeType: string;
  bytes: Uint8Array;
}) {
  if (input.kind === "TEXT") {
    if (input.mimeType === WORD_DOCUMENT_MIME_TYPE) {
      return extractDocxText(input.bytes);
    }

    return sliceExtractedText(
      new TextDecoder("utf-8", { fatal: false }).decode(input.bytes).replace(/\0/g, ""),
    );
  }

  if (input.kind === "PDF" && input.mimeType === "application/pdf") {
    return extractPdfText(input.bytes);
  }

  return null;
}

export { WORD_DOCUMENT_MIME_TYPE };
