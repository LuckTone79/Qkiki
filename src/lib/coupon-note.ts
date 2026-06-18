export function normalizeCouponNote(note: string | null | undefined) {
  const normalized = note?.trim() ?? "";
  return normalized.length ? normalized : null;
}
