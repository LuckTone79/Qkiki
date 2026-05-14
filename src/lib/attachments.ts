import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { AttachmentKind, SessionAttachment } from "@prisma/client";

export type AttachmentMeta = {
  id: string;
  name: string;
  mimeType: string;
  kind: AttachmentKind;
  sizeBytes: number;
  createdAt: string;
};

export type RuntimeAttachment = AttachmentMeta & {
  extractedText: string | null;
  storagePath: string;
  dataBase64?: string;
};

const STORAGE_DIR = path.join(
  process.env.ATTACHMENT_STORAGE_DIR || process.env.TMPDIR || "/tmp",
  "qkiki-storage",
  "attachments",
);
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_RUN = 8;
const MAX_EXTRACTED_TEXT_LENGTH = 40000;
const MAX_PROMPT_TEXT_LENGTH = 24000;

const textExtensions = new Set([".txt", ".md", ".csv", ".json"]);
const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

function sanitizeName(value: string) {
  return value.replace(/[^\w.\-() ]+/g, "_").slice(0, 120) || "attachment";
}

function extensionOf(name: string) {
  return path.extname(name).toLowerCase();
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
    textExtensions.has(extensionOf(fileName))
  ) {
    return "TEXT";
  }

  return null;
}

async function extractPdfText(buffer: Buffer) {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return (result.text || "").trim();
  } finally {
    await parser.destroy();
  }
}

async function extractAttachmentText(
  kind: AttachmentKind,
  mimeType: string,
  buffer: Buffer,
) {
  if (kind === "TEXT") {
    return new TextDecoder("utf-8", { fatal: false })
      .decode(buffer)
      .replace(/\0/g, "")
      .trim()
      .slice(0, MAX_EXTRACTED_TEXT_LENGTH);
  }

  if (kind === "PDF" && mimeType === "application/pdf") {
    const text = await extractPdfText(buffer);
    return text.slice(0, MAX_EXTRACTED_TEXT_LENGTH);
  }

  return null;
}

function toMeta(attachment: SessionAttachment): AttachmentMeta {
  return {
    id: attachment.id,
    name: attachment.name,
    mimeType: attachment.mimeType,
    kind: attachment.kind,
    sizeBytes: attachment.sizeBytes,
    createdAt: attachment.createdAt.toISOString(),
  };
}

export function listAcceptedAttachmentTypes() {
  return ".txt,.md,.csv,.json,.pdf,image/png,image/jpeg,image/webp,image/gif";
}

export function getAttachmentLimits() {
  return {
    maxBytes: MAX_ATTACHMENT_BYTES,
    maxPerRun: MAX_ATTACHMENTS_PER_RUN,
  };
}

export async function createAttachment(input: {
  userId: string;
  fileName: string;
  mimeType?: string | null;
  bytes: Uint8Array;
  sessionId?: string | null;
}) {
  const safeName = sanitizeName(input.fileName);
  const mimeType = normalizeMimeType(safeName, input.mimeType);
  const kind = getAttachmentKind(mimeType, safeName);

  if (!kind) {
    throw new Error("Supported attachments are text, JSON, CSV, Markdown, PDF, and common images.");
  }

  if (input.bytes.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new Error(`Each attachment must be ${Math.floor(MAX_ATTACHMENT_BYTES / (1024 * 1024))}MB or smaller.`);
  }

  const now = new Date();
  const folder = path.join(
    STORAGE_DIR,
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
  );
  const storedName = `${Date.now()}-${randomUUID()}${extensionOf(safeName)}`;
  const absolutePath = path.join(folder, storedName);
  const buffer = Buffer.from(input.bytes);
  try {
    await mkdir(folder, { recursive: true });
    await writeFile(absolutePath, buffer);
  } catch (error) {
    console.warn("[attachments] falling back to database-backed storage", error);
  }

  const extractedText = await extractAttachmentText(kind, mimeType, buffer);

  const created = await prisma.sessionAttachment.create({
    data: {
      userId: input.userId,
      sessionId: input.sessionId || null,
      name: safeName,
      mimeType,
      kind,
      sizeBytes: buffer.byteLength,
      storagePath: absolutePath,
      extractedText,
      dataBase64: buffer.toString("base64"),
    },
  });

  return toMeta(created);
}

export async function getSessionAttachments(sessionId: string) {
  const attachments = await prisma.sessionAttachment.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });
  return attachments.map(toMeta);
}

export async function claimSessionAttachments(input: {
  userId: string;
  sessionId: string;
  attachmentIds?: string[];
}) {
  const uniqueIds = Array.from(new Set((input.attachmentIds || []).filter(Boolean)));

  if (!uniqueIds.length) {
    return [];
  }

  if (uniqueIds.length > MAX_ATTACHMENTS_PER_RUN) {
    throw new Error(`You can attach up to ${MAX_ATTACHMENTS_PER_RUN} files per run.`);
  }

  const attachments = await prisma.sessionAttachment.findMany({
    where: {
      id: { in: uniqueIds },
      userId: input.userId,
      OR: [{ sessionId: null }, { sessionId: input.sessionId }],
    },
    orderBy: { createdAt: "asc" },
  });

  if (attachments.length !== uniqueIds.length) {
    throw new Error("One or more attachments could not be used in this session.");
  }

  await prisma.sessionAttachment.updateMany({
    where: {
      id: { in: uniqueIds },
      userId: input.userId,
      sessionId: null,
    },
    data: { sessionId: input.sessionId },
  });

  const refreshed = await prisma.sessionAttachment.findMany({
    where: {
      id: { in: uniqueIds },
      userId: input.userId,
      sessionId: input.sessionId,
    },
    orderBy: { createdAt: "asc" },
  });

  return refreshed;
}

export async function getAllSessionRuntimeAttachments(input: {
  userId: string;
  sessionId: string;
}) {
  const attachments = await prisma.sessionAttachment.findMany({
    where: { userId: input.userId, sessionId: input.sessionId },
    orderBy: { createdAt: "asc" },
  });
  return hydrateRuntimeAttachments(attachments);
}

export async function getRuntimeAttachmentsByIds(input: {
  userId: string;
  sessionId?: string | null;
  attachmentIds: string[];
}) {
  const uniqueIds = Array.from(new Set(input.attachmentIds.filter(Boolean)));
  if (!uniqueIds.length) {
    return [];
  }

  const attachments = await prisma.sessionAttachment.findMany({
    where: {
      id: { in: uniqueIds },
      userId: input.userId,
      ...(input.sessionId
        ? { OR: [{ sessionId: input.sessionId }, { sessionId: null }] }
        : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  if (attachments.length !== uniqueIds.length) {
    throw new Error("One or more attachments are no longer available.");
  }

  return hydrateRuntimeAttachments(attachments);
}

export async function hydrateRuntimeAttachments(
  attachments: SessionAttachment[],
): Promise<RuntimeAttachment[]> {
  return Promise.all(
    attachments.map(async (attachment) => {
      let dataBase64: string | undefined;
      let extractedText = attachment.extractedText;
      if (attachment.kind === "IMAGE") {
        dataBase64 = attachment.dataBase64 ?? undefined;
        if (!dataBase64) {
          try {
            const bytes = await readFile(attachment.storagePath);
            dataBase64 = bytes.toString("base64");
          } catch (error) {
            console.warn("[attachments] image bytes unavailable", {
              attachmentId: attachment.id,
              storagePath: attachment.storagePath,
              error,
            });
          }
        }
        if (!dataBase64) {
          extractedText =
            extractedText ||
            "[Attached image bytes are unavailable. Ask the user to upload this image again if visual details are required.]";
        }
      }

      return {
        ...toMeta(attachment),
        extractedText,
        storagePath: attachment.storagePath,
        dataBase64,
      };
    }),
  );
}

export async function deleteAttachment(input: {
  id: string;
  userId: string;
}) {
  const attachment = await prisma.sessionAttachment.findFirst({
    where: { id: input.id, userId: input.userId },
    include: {
      resultLinks: {
        select: { resultId: true },
        take: 1,
      },
    },
  });

  if (!attachment) {
    throw new Error("Attachment not found.");
  }

  if (attachment.resultLinks.length) {
    throw new Error("This attachment is already linked to saved results and cannot be removed.");
  }

  await prisma.sessionAttachment.delete({
    where: { id: attachment.id },
  });
}

export function buildAttachmentContext(attachments: RuntimeAttachment[]) {
  const textParts: string[] = [];
  let consumed = 0;

  attachments.forEach((attachment, index) => {
    if (!attachment.extractedText?.trim()) {
      return;
    }

    if (consumed >= MAX_PROMPT_TEXT_LENGTH) {
      return;
    }

    const remaining = MAX_PROMPT_TEXT_LENGTH - consumed;
    const text = attachment.extractedText.trim().slice(0, remaining);
    consumed += text.length;
    textParts.push(
      [
        `[Attached file ${index + 1}] ${attachment.name}`,
        `Type: ${attachment.mimeType}`,
        text,
      ].join("\n"),
    );
  });

  if (!textParts.length) {
    return "";
  }

  return ["Attached file context:", ...textParts].join("\n\n");
}
