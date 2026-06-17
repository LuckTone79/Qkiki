/**
 * Helpers for working with generated-image output.
 *
 * Image-generation models return their result as base64 image bytes. We store
 * that as a `data:` URL inside `Result.outputText` (no schema change), and the
 * UI detects the prefix to render the image instead of plain text. These
 * helpers stay free of `server-only`/React imports so both the provider layer
 * (server) and the result cards (client) can share them.
 */

const IMAGE_DATA_URL_PREFIX = /^data:image\/[a-zA-Z0-9.+-]+;base64,/;

/**
 * Placeholder substituted when an image result would otherwise be fed into a
 * text prompt (sequential source text, branch reviews, comparison summaries).
 * Passing a multi-megabyte base64 data URL into a text model is both wasteful
 * and meaningless, so we send this note instead.
 */
export const IMAGE_OUTPUT_TEXT_PLACEHOLDER =
  "[An image was generated for this result. The raw image cannot be used as text input.]";

export function buildImageDataUrl(base64: string, mimeType?: string | null) {
  const normalizedType = mimeType?.trim() || "image/png";
  return `data:${normalizedType};base64,${base64}`;
}

export function isImageDataUrl(value: string | null | undefined): value is string {
  return typeof value === "string" && IMAGE_DATA_URL_PREFIX.test(value.trim());
}

/**
 * Returns the given output text unless it is an image data URL, in which case a
 * short placeholder is returned so the bytes never leak into a text prompt.
 */
export function textOutputForPrompt(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return isImageDataUrl(value) ? IMAGE_OUTPUT_TEXT_PLACEHOLDER : value;
}
