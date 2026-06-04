export function sanitizeRepeatCountDraftInput(raw: string) {
  if (raw === "") {
    return "";
  }

  return /^\d+$/.test(raw) ? raw : null;
}

export function finalizeRepeatCountDraft(
  raw: string,
  fallback: number,
  max: number,
) {
  if (raw === "") {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, 1), max);
}
