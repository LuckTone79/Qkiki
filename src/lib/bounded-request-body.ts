export type BoundedRequestBodyResult =
  | { ok: true; bodyText: string; byteLength: number }
  | { ok: false; reason: "invalid-content-length" | "too-large" };

function parseContentLength(value: string | null) {
  if (value === null) {
    return null;
  }

  if (!/^\d+$/.test(value)) {
    return Number.NaN;
  }

  return Number(value);
}

/**
 * Reads an HTTP request body without ever buffering more than maxBytes.
 * Content-Length is only an early rejection signal; streamed/chunked bodies
 * are still counted while they are consumed.
 */
export async function readBoundedRequestBody(
  request: Request,
  maxBytes: number,
): Promise<BoundedRequestBodyResult> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new TypeError("maxBytes must be a non-negative safe integer.");
  }

  const contentLength = parseContentLength(request.headers.get("content-length"));
  if (Number.isNaN(contentLength) || (contentLength !== null && contentLength > maxBytes)) {
    return {
      ok: false,
      reason: Number.isNaN(contentLength) ? "invalid-content-length" : "too-large",
    };
  }

  if (!request.body) {
    return { ok: true, bodyText: "", byteLength: 0 };
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let byteLength = 0;
  let bodyText = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      byteLength += value.byteLength;
      if (byteLength > maxBytes) {
        await reader.cancel("Request body exceeded the configured limit.");
        return { ok: false, reason: "too-large" };
      }

      bodyText += decoder.decode(value, { stream: true });
    }

    bodyText += decoder.decode();
    return { ok: true, bodyText, byteLength };
  } catch {
    return { ok: false, reason: "invalid-content-length" };
  } finally {
    reader.releaseLock();
  }
}
