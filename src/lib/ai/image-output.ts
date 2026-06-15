/**
 * Helpers for image-generation results.
 *
 * Generated images are stored in a result's `outputText` as a base64 data URL
 * (e.g. `data:image/png;base64,...`). This keeps image results inside the same
 * pipeline as text results without a schema change. These helpers let the UI and
 * the workflow layer recognize and safely preview such outputs.
 */

const IMAGE_DATA_URL_PATTERN = /^data:image\/[a-z0-9.+-]+;base64,/i;

export function isImageDataUrl(value: string | null | undefined): value is string {
  return typeof value === "string" && IMAGE_DATA_URL_PATTERN.test(value.trim());
}

export function imageOutputPlaceholder(language: "en" | "ko") {
  return language === "ko" ? "[생성된 이미지]" : "[Generated image]";
}

/**
 * Replaces an image data URL with a short marker so it never leaks into text
 * prompts (e.g. sequential source text or the parallel comparison summary),
 * where a multi-megabyte base64 string would be useless and get truncated.
 */
export function stripImageDataUrlForText(value: string | null | undefined) {
  if (isImageDataUrl(value)) {
    return "[A generated image was produced for this step; the binary image data is omitted from text context.]";
  }

  return value ?? "";
}
