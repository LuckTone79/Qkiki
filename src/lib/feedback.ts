import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { FeedbackAttachment } from "@prisma/client";

export const FEEDBACK_CATEGORIES = [
  "BUG",
  "FEATURE",
  "IMPROVEMENT",
  "QUESTION",
  "OTHER",
] as const;

export const FEEDBACK_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
] as const;

export const MAX_FEEDBACK_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_FEEDBACK_ATTACHMENTS = 10;
export const MAX_FEEDBACK_TITLE_LENGTH = 200;
export const MAX_FEEDBACK_BODY_LENGTH = 20000;

const STORAGE_DIR = path.join(
  process.env.ATTACHMENT_STORAGE_DIR || process.env.TMPDIR || "/tmp",
  "yapp-storage",
  "feedback",
);

const acceptedImageMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const imageExtensions: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export type FeedbackAttachmentMeta = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
};

export function isAcceptedFeedbackImage(mimeType: string) {
  return acceptedImageMimeTypes.has(mimeType.trim().toLowerCase());
}

export function listAcceptedFeedbackImageTypes() {
  return Array.from(acceptedImageMimeTypes).join(",");
}

export function feedbackAttachmentUrl(id: string) {
  return `/api/feedback/attachments/${id}/raw`;
}

function sanitizeName(value: string) {
  return value.replace(/[^\w.\-() ]+/g, "_").slice(0, 120) || "image";
}

export function toFeedbackAttachmentMeta(
  attachment: FeedbackAttachment,
): FeedbackAttachmentMeta {
  return {
    id: attachment.id,
    name: attachment.name,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    url: feedbackAttachmentUrl(attachment.id),
    createdAt: attachment.createdAt.toISOString(),
  };
}

export async function createFeedbackAttachment(input: {
  userId: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}) {
  const mimeType = input.mimeType.trim().toLowerCase();

  if (!isAcceptedFeedbackImage(mimeType)) {
    throw new Error("Only PNG, JPEG, WebP, and GIF images can be attached.");
  }

  if (input.bytes.byteLength > MAX_FEEDBACK_IMAGE_BYTES) {
    throw new Error(
      `Each image must be ${Math.floor(MAX_FEEDBACK_IMAGE_BYTES / (1024 * 1024))}MB or smaller.`,
    );
  }

  const pendingCount = await prisma.feedbackAttachment.count({
    where: { userId: input.userId, postId: null },
  });
  if (pendingCount >= MAX_FEEDBACK_ATTACHMENTS) {
    throw new Error(
      `You can attach up to ${MAX_FEEDBACK_ATTACHMENTS} images per post.`,
    );
  }

  const safeName = sanitizeName(input.fileName);
  const now = new Date();
  const folder = path.join(
    STORAGE_DIR,
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
  );
  const storedName = `${Date.now()}-${randomUUID()}${imageExtensions[mimeType] || ""}`;
  const absolutePath = path.join(folder, storedName);
  const buffer = Buffer.from(input.bytes);

  try {
    await mkdir(folder, { recursive: true });
    await writeFile(absolutePath, buffer);
  } catch (error) {
    console.warn("[feedback] falling back to database-backed storage", error);
  }

  const created = await prisma.feedbackAttachment.create({
    data: {
      userId: input.userId,
      name: safeName,
      mimeType,
      sizeBytes: buffer.byteLength,
      storagePath: absolutePath,
      dataBase64: buffer.toString("base64"),
    },
  });

  return toFeedbackAttachmentMeta(created);
}

export async function readFeedbackAttachmentBytes(attachment: FeedbackAttachment) {
  if (attachment.dataBase64) {
    return Buffer.from(attachment.dataBase64, "base64");
  }
  try {
    return await readFile(attachment.storagePath);
  } catch (error) {
    console.warn("[feedback] attachment bytes unavailable", {
      attachmentId: attachment.id,
      error,
    });
    return null;
  }
}

const ATTACHMENT_REFERENCE_PATTERN =
  /\/api\/feedback\/attachments\/([a-z0-9]+)\/raw/gi;

export function extractReferencedAttachmentIds(body: string) {
  const ids = new Set<string>();
  for (const match of body.matchAll(ATTACHMENT_REFERENCE_PATTERN)) {
    if (match[1]) {
      ids.add(match[1]);
    }
  }
  return Array.from(ids);
}

/**
 * Links the caller's pending (unclaimed) attachments to a post. Only attachments
 * owned by the user that are not yet attached to another post are linked.
 */
export async function claimFeedbackAttachments(input: {
  userId: string;
  postId: string;
  attachmentIds: string[];
}) {
  const uniqueIds = Array.from(new Set(input.attachmentIds.filter(Boolean)));
  if (!uniqueIds.length) {
    return;
  }

  if (uniqueIds.length > MAX_FEEDBACK_ATTACHMENTS) {
    throw new Error(
      `You can attach up to ${MAX_FEEDBACK_ATTACHMENTS} images per post.`,
    );
  }

  await prisma.feedbackAttachment.updateMany({
    where: {
      id: { in: uniqueIds },
      userId: input.userId,
      postId: null,
    },
    data: { postId: input.postId },
  });
}
