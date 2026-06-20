/**
 * local-cache.ts
 *
 * Thin localStorage wrapper for two purposes:
 *  1. Workbench draft  – saves unsaved input so the user can restore it on return.
 *  2. Session cache    – stores a server-fetched session locally so it loads
 *                        instantly on next visit (same device) while the server
 *                        syncs silently in the background (cross-device).
 *
 * All operations are wrapped in try/catch so private-browsing mode and
 * storage-quota errors never crash the app.
 */

import { LEGACY_STORAGE_KEYS, PRIMARY_STORAGE_KEYS } from "@/lib/brand";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WorkbenchDraft = {
  originalInput: string;
  additionalInstruction: string;
  outputStyle: string;
  outputLanguage?: string;
  mode: "parallel" | "sequential";
  attachments: Array<{
    id: string;
    name: string;
    mimeType: string;
    kind: "TEXT" | "IMAGE" | "PDF";
    sizeBytes: number;
    createdAt: string;
  }>;
  workflowSteps: Array<{
    uid: string;
    orderIndex: number;
    actionType: string;
    targetProvider: string;
    targetModel: string;
    sourceMode: string;
    sourceResultId?: string | null;
    instructionTemplate?: string | null;
  }>;
  workflowControl?: unknown;
  savedAt: number; // Unix ms timestamp
};

export type SessionCacheEntry<T> = {
  data: T;
  cachedAt: number; // Unix ms timestamp
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DRAFT_KEY = PRIMARY_STORAGE_KEYS.draft;
const SESSION_PREFIX = PRIMARY_STORAGE_KEYS.sessionPrefix;
const USAGE_KEY = PRIMARY_STORAGE_KEYS.usage;
const LEGACY_DRAFT_KEYS = LEGACY_STORAGE_KEYS.draft;
const LEGACY_SESSION_PREFIXES = LEGACY_STORAGE_KEYS.sessionPrefix;
const LEGACY_USAGE_KEYS = LEGACY_STORAGE_KEYS.usage;
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;   // 7 days
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;       // 12 hours
const USAGE_TTL_MS = 15 * 1000; // 15 seconds

// ─── Storage helpers ──────────────────────────────────────────────────────────

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function readFirst<T>(keys: readonly string[]): T | null {
  for (const key of keys) {
    const value = read<T>(key);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or private-browsing mode — fail silently
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {}
}

// ─── Draft API ────────────────────────────────────────────────────────────────

/** Persist the current unsaved workbench state. */
export function saveDraft(draft: Omit<WorkbenchDraft, "savedAt">): void {
  write(DRAFT_KEY, { ...draft, savedAt: Date.now() });
}

/** Return the draft if it exists and has not expired, otherwise null. */
export function loadDraft(): WorkbenchDraft | null {
  const entry = readFirst<WorkbenchDraft>([DRAFT_KEY, ...LEGACY_DRAFT_KEYS]);
  if (!entry) return null;
  if (Date.now() - entry.savedAt > DRAFT_TTL_MS) {
    remove(DRAFT_KEY);
    return null;
  }
  return entry;
}

/** Delete the draft (call after a successful run or explicit user dismiss). */
export function clearDraft(): void {
  remove(DRAFT_KEY);
  LEGACY_DRAFT_KEYS.forEach(remove);
}

// ─── Session cache API ────────────────────────────────────────────────────────

/** Store a server-fetched session locally for fast future loads. */
export function writeSessionCache<T>(id: string, data: T): void {
  write(`${SESSION_PREFIX}${id}`, {
    data,
    cachedAt: Date.now(),
  } satisfies SessionCacheEntry<T>);
}

/**
 * Return a cached session if it exists and has not expired.
 * Returns null when the cache is cold, expired, or unavailable.
 */
export function readSessionCache<T>(id: string): SessionCacheEntry<T> | null {
  const entry = readFirst<SessionCacheEntry<T>>([
    `${SESSION_PREFIX}${id}`,
    ...LEGACY_SESSION_PREFIXES.map((prefix) => `${prefix}${id}`),
  ]);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > SESSION_TTL_MS) {
    remove(`${SESSION_PREFIX}${id}`);
    return null;
  }
  return entry;
}

/** Store the most recent usage snapshot to avoid repeated short-interval refetches. */
export function writeUsageCache<T>(data: T): void {
  write(USAGE_KEY, {
    data,
    cachedAt: Date.now(),
  } satisfies SessionCacheEntry<T>);
}

/** Return the cached usage snapshot when it is still fresh. */
export function readUsageCache<T>(): SessionCacheEntry<T> | null {
  const entry = readFirst<SessionCacheEntry<T>>([USAGE_KEY, ...LEGACY_USAGE_KEYS]);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > USAGE_TTL_MS) {
    remove(USAGE_KEY);
    return null;
  }
  return entry;
}
