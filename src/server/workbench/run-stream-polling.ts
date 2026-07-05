export type RunStreamCursorInput = {
  status: string;
  runUpdatedAt: Date;
  stepUpdatedAt: Date | null;
  stepCount: number;
};

export function buildRunStreamCursor(input: RunStreamCursorInput) {
  return [
    input.status,
    input.runUpdatedAt.toISOString(),
    input.stepUpdatedAt?.toISOString() ?? "none",
    String(input.stepCount),
  ].join(":");
}

export function getRunStreamPollDelayMs(unchangedPollCount: number) {
  const safeCount = Math.max(0, Math.floor(unchangedPollCount));
  if (safeCount <= 1) {
    return 1000;
  }
  return Math.min(3000, 1000 + (safeCount - 1) * 500);
}
