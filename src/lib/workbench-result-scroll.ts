export function resolveResultStartTarget(input: {
  activeResultId: string | null;
  visibleResultIds: string[];
}) {
  if (
    input.activeResultId &&
    input.visibleResultIds.includes(input.activeResultId)
  ) {
    return input.activeResultId;
  }

  return input.visibleResultIds[0] ?? null;
}
