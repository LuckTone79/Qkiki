import "server-only";

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  AttachmentFileValidationError,
  extractAttachmentTextContent,
  listAcceptedAttachmentTypes as listAcceptedAttachmentTypeValues,
  resolveAttachmentDescriptor,
  validateAttachmentContent,
} from "@/lib/attachment-files";
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
  "yapp-storage",
  "attachments",
);
export const MAX_ATTACHMENT_BYTES = 4_000_000;
export const MAX_ATTACHMENT_REQUEST_BYTES = 4_500_000;
const MAX_ATTACHMENT_BYTES_PER_RUN = 16 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_RUN = 8;
const MAX_ATTACHMENTS_PER_USER = 100;
const MAX_ATTACHMENT_BYTES_PER_USER = 64 * 1024 * 1024;
const MAX_PROMPT_TEXT_LENGTH = 24000;

export type AttachmentPolicyErrorCode =
  | "INVALID_FILE"
  | "FILE_TOO_LARGE"
  | "USER_QUOTA_EXCEEDED"
  | "RUN_QUOTA_EXCEEDED";

export class AttachmentPolicyError extends Error {
  constructor(
    message: string,
    readonly code: AttachmentPolicyErrorCode,
  ) {
    super(message);
    this.name = "AttachmentPolicyError";
  }
}

function sanitizeName(value: string) {
  return value.replace(/[^\w.\-() ]+/g, "_").slice(0, 120) || "attachment";
}

function extensionOf(name: string) {
  return path.extname(name).toLowerCase();
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
  return listAcceptedAttachmentTypeValues();
}

export function getAttachmentLimits() {
  return {
    maxBytes: MAX_ATTACHMENT_BYTES,
    maxRequestBytes: MAX_ATTACHMENT_REQUEST_BYTES,
    maxPerRun: MAX_ATTACHMENTS_PER_RUN,
    maxBytesPerRun: MAX_ATTACHMENT_BYTES_PER_RUN,
    maxPerUser: MAX_ATTACHMENTS_PER_USER,
    maxBytesPerUser: MAX_ATTACHMENT_BYTES_PER_USER,
  };
}

function assertUserAttachmentQuota(
  usage: { count: number; sizeBytes: number },
  incomingBytes: number,
) {
  if (
    usage.count >= MAX_ATTACHMENTS_PER_USER ||
    usage.sizeBytes + incomingBytes > MAX_ATTACHMENT_BYTES_PER_USER
  ) {
    throw new AttachmentPolicyError(
      "Your attachment storage quota has been reached. Remove unused attachments before uploading another file.",
      "USER_QUOTA_EXCEEDED",
    );
  }
}

async function readUserAttachmentUsage(userId: string) {
  const usage = await prisma.sessionAttachment.aggregate({
    where: { userId },
    _count: { _all: true },
    _sum: { sizeBytes: true },
  });
  return {
    count: usage._count._all,
    sizeBytes: usage._sum.sizeBytes || 0,
  };
}

function isPathWithinStorage(storagePath: string) {
  const root = path.resolve(STORAGE_DIR);
  const candidate = path.resolve(storagePath);
  return candidate.startsWith(`${root}${path.sep}`);
}

async function removeStoredAttachmentFile(storagePath: string) {
  if (!storagePath || !isPathWithinStorage(storagePath)) {
    return;
  }

  try {
    await unlink(storagePath);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return;
    }
    throw new Error("The attachment file could not be removed from storage.");
  }
}

export async function createAttachment(input: {
  userId: string;
  fileName: string;
  mimeType?: string | null;
  bytes: Uint8Array;
  sessionId?: string | null;
}) {
  const safeName = sanitizeName(input.fileName);
  const descriptor = resolveAttachmentDescriptor(safeName, input.mimeType);

  if (!descriptor) {
    throw new AttachmentPolicyError(
      "The file extension and content type must match a supported text, JSON, CSV, Markdown, Word (.docx), PDF, or image format.",
      "INVALID_FILE",
    );
  }
  const { kind, mimeType } = descriptor;

  if (input.bytes.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new AttachmentPolicyError(
      `Each attachment must be ${Math.floor(MAX_ATTACHMENT_BYTES / 1_000_000)}MB or smaller.`,
      "FILE_TOO_LARGE",
    );
  }

  assertUserAttachmentQuota(
    await readUserAttachmentUsage(input.userId),
    input.bytes.byteLength,
  );

  try {
    validateAttachmentContent({
      fileName: safeName,
      kind,
      mimeType,
      bytes: input.bytes,
    });
  } catch (error) {
    if (error instanceof AttachmentFileValidationError) {
      throw error;
    }
    throw new AttachmentPolicyError("The attachment could not be validated safely.", "INVALID_FILE");
  }

  const buffer = Buffer.from(input.bytes);
  const extractedText = await extractAttachmentTextContent({
    kind,
    mimeType,
    bytes: buffer,
  });

  const now = new Date();
  const folder = path.join(
    STORAGE_DIR,
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
  );
  const storedName = `${Date.now()}-${randomUUID()}${extensionOf(safeName)}`;
  const absolutePath = path.join(folder, storedName);
  let wroteFile = false;
  try {
    await mkdir(folder, { recursive: true });
    await writeFile(absolutePath, buffer);
    wroteFile = true;
  } catch {
    console.warn("[attachments] filesystem storage unavailable; using database-backed storage");
  }

  let created: SessionAttachment;
  try {
    created = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`attachment-quota:${input.userId}`}, 0)
        )
      `;
      const usage = await transaction.sessionAttachment.aggregate({
        where: { userId: input.userId },
        _count: { _all: true },
        _sum: { sizeBytes: true },
      });
      assertUserAttachmentQuota(
        {
          count: usage._count._all,
          sizeBytes: usage._sum.sizeBytes || 0,
        },
        buffer.byteLength,
      );

      return transaction.sessionAttachment.create({
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
    });
  } catch (error) {
    if (wroteFile) {
      await removeStoredAttachmentFile(absolutePath).catch(() => undefined);
    }
    throw error;
  }

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

  const totalBytes = attachments.reduce(
    (sum, attachment) => sum + attachment.sizeBytes,
    0,
  );
  if (totalBytes > MAX_ATTACHMENT_BYTES_PER_RUN) {
    throw new AttachmentPolicyError(
      `Attachments for one run may total at most ${Math.floor(MAX_ATTACHMENT_BYTES_PER_RUN / (1024 * 1024))}MB.`,
      "RUN_QUOTA_EXCEEDED",
    );
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

  await removeStoredAttachmentFile(attachment.storagePath);
  await prisma.sessionAttachment.delete({ where: { id: attachment.id } });
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
