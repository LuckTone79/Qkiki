import path from "node:path";
import type { AttachmentKind } from "@prisma/client";

const MAX_EXTRACTED_TEXT_LENGTH = 40000;
const MAX_PDF_PAGES_TO_EXTRACT = 40;
const MAX_PDF_TOTAL_PAGES = 500;
const MAX_IMAGE_DIMENSION = 8192;
const MAX_IMAGE_PIXELS = 24_000_000;
const MAX_DOCX_ENTRIES = 512;
const MAX_DOCX_UNCOMPRESSED_BYTES = 16 * 1024 * 1024;
const MAX_DOCX_ENTRY_BYTES = 12 * 1024 * 1024;
const MAX_DOCX_COMPRESSION_RATIO = 100;

const WORD_DOCUMENT_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type AttachmentTypeRule = {
  kind: AttachmentKind;
  canonicalMimeType: string;
  acceptedMimeTypes: ReadonlySet<string>;
};

function typeRule(
  kind: AttachmentKind,
  canonicalMimeType: string,
  acceptedMimeTypes: string[] = [canonicalMimeType],
): AttachmentTypeRule {
  return {
    kind,
    canonicalMimeType,
    acceptedMimeTypes: new Set(acceptedMimeTypes),
  };
}

const ATTACHMENT_TYPE_RULES = new Map<string, AttachmentTypeRule>([
  [".txt", typeRule("TEXT", "text/plain")],
  [".md", typeRule("TEXT", "text/markdown", ["text/markdown", "text/plain"])],
  [".csv", typeRule("TEXT", "text/csv", ["text/csv", "application/csv", "text/plain"])],
  [".json", typeRule("TEXT", "application/json", ["application/json", "text/json"])],
  [".docx", typeRule("TEXT", WORD_DOCUMENT_MIME_TYPE)],
  [".pdf", typeRule("PDF", "application/pdf")],
  [".png", typeRule("IMAGE", "image/png")],
  [".jpg", typeRule("IMAGE", "image/jpeg")],
  [".jpeg", typeRule("IMAGE", "image/jpeg")],
  [".webp", typeRule("IMAGE", "image/webp")],
  [".gif", typeRule("IMAGE", "image/gif")],
]);

export class AttachmentFileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttachmentFileValidationError";
  }
}

function extensionOf(name: string) {
  return path.extname(name).toLowerCase();
}

function sliceExtractedText(value: string) {
  return value.trim().slice(0, MAX_EXTRACTED_TEXT_LENGTH);
}

function normalizedDeclaredMimeType(mimeType?: string | null) {
  const normalized = mimeType?.split(";", 1)[0]?.trim().toLowerCase();
  if (!normalized || normalized === "application/octet-stream") {
    return null;
  }
  return normalized;
}

function failValidation(message: string): never {
  throw new AttachmentFileValidationError(message);
}

function startsWithBytes(bytes: Uint8Array, expected: number[], offset = 0) {
  if (bytes.byteLength < offset + expected.length) {
    return false;
  }
  return expected.every((value, index) => bytes[offset + index] === value);
}

function readUint16BE(bytes: Uint8Array, offset: number) {
  return (bytes[offset]! << 8) | bytes[offset + 1]!;
}

function readUint16LE(bytes: Uint8Array, offset: number) {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function readUint24LE(bytes: Uint8Array, offset: number) {
  return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);
}

function readUint32BE(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset]! * 0x1000000 +
    ((bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!)
  );
}

function readUint32LE(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset]! +
    bytes[offset + 1]! * 0x100 +
    bytes[offset + 2]! * 0x10000 +
    bytes[offset + 3]! * 0x1000000
  );
}

function validateImageDimensions(width: number, height: number) {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width > MAX_IMAGE_DIMENSION ||
    height > MAX_IMAGE_DIMENSION ||
    width * height > MAX_IMAGE_PIXELS
  ) {
    failValidation("The image dimensions are too large or invalid.");
  }
}

function jpegDimensions(bytes: Uint8Array) {
  if (!startsWithBytes(bytes, [0xff, 0xd8, 0xff])) {
    failValidation("The file content does not match its JPEG type.");
  }

  const startOfFrameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
    0xcf,
  ]);
  let offset = 2;

  while (offset + 3 < bytes.byteLength) {
    while (bytes[offset] === 0xff) {
      offset += 1;
    }
    const marker = bytes[offset++];
    if (marker === undefined || marker === 0xd9 || marker === 0xda) {
      break;
    }
    if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    if (offset + 2 > bytes.byteLength) {
      break;
    }
    const segmentLength = readUint16BE(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.byteLength) {
      failValidation("The JPEG structure is invalid.");
    }
    if (startOfFrameMarkers.has(marker)) {
      if (segmentLength < 7) {
        failValidation("The JPEG dimensions are invalid.");
      }
      return {
        height: readUint16BE(bytes, offset + 3),
        width: readUint16BE(bytes, offset + 5),
      };
    }
    offset += segmentLength;
  }

  failValidation("The JPEG dimensions could not be verified.");
}

function webpDimensions(bytes: Uint8Array) {
  if (
    !startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46]) ||
    !startsWithBytes(bytes, [0x57, 0x45, 0x42, 0x50], 8) ||
    bytes.byteLength < 30
  ) {
    failValidation("The file content does not match its WebP type.");
  }

  const declaredLength = readUint32LE(bytes, 4) + 8;
  if (declaredLength !== bytes.byteLength) {
    failValidation("The WebP container length is invalid.");
  }

  const chunkType = new TextDecoder("ascii", { fatal: true }).decode(bytes.subarray(12, 16));
  if (chunkType === "VP8X") {
    return {
      width: readUint24LE(bytes, 24) + 1,
      height: readUint24LE(bytes, 27) + 1,
    };
  }
  if (chunkType === "VP8L" && bytes[20] === 0x2f && bytes.byteLength >= 25) {
    return {
      width: 1 + (((bytes[22]! & 0x3f) << 8) | bytes[21]!),
      height: 1 + (((bytes[24]! & 0x0f) << 10) | (bytes[23]! << 2) | (bytes[22]! >> 6)),
    };
  }
  if (
    chunkType === "VP8 " &&
    bytes.byteLength >= 30 &&
    startsWithBytes(bytes, [0x9d, 0x01, 0x2a], 23)
  ) {
    return {
      width: readUint16LE(bytes, 26) & 0x3fff,
      height: readUint16LE(bytes, 28) & 0x3fff,
    };
  }

  failValidation("The WebP dimensions could not be verified.");
}

function validateImageContent(mimeType: string, bytes: Uint8Array) {
  let dimensions: { width: number; height: number };

  if (mimeType === "image/png") {
    if (
      !startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) ||
      bytes.byteLength < 33 ||
      readUint32BE(bytes, 8) !== 13 ||
      !startsWithBytes(bytes, [0x49, 0x48, 0x44, 0x52], 12)
    ) {
      failValidation("The file content does not match its PNG type.");
    }
    dimensions = {
      width: readUint32BE(bytes, 16),
      height: readUint32BE(bytes, 20),
    };
  } else if (mimeType === "image/jpeg") {
    dimensions = jpegDimensions(bytes);
  } else if (mimeType === "image/gif") {
    if (
      bytes.byteLength < 13 ||
      (!startsWithBytes(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) &&
        !startsWithBytes(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))
    ) {
      failValidation("The file content does not match its GIF type.");
    }
    dimensions = {
      width: readUint16LE(bytes, 6),
      height: readUint16LE(bytes, 8),
    };
  } else if (mimeType === "image/webp") {
    dimensions = webpDimensions(bytes);
  } else {
    failValidation("The image type is not supported.");
  }

  validateImageDimensions(dimensions.width, dimensions.height);
}

function validatePdfContainer(bytes: Uint8Array) {
  if (
    bytes.byteLength < 12 ||
    !startsWithBytes(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]) ||
    bytes[5] < 0x31 ||
    bytes[5] > 0x32 ||
    bytes[6] !== 0x2e ||
    bytes[7] < 0x30 ||
    bytes[7] > 0x39
  ) {
    failValidation("The file content does not match its PDF type.");
  }

  const trailerStart = Math.max(0, bytes.byteLength - 2048);
  const trailer = new TextDecoder("latin1").decode(bytes.subarray(trailerStart));
  if (!trailer.includes("%%EOF")) {
    failValidation("The PDF trailer is missing or invalid.");
  }
}

function validateDocxContainer(bytes: Uint8Array) {
  if (!startsWithBytes(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    failValidation("The file content does not match its Word (.docx) type.");
  }

  const minimumEocdOffset = Math.max(0, bytes.byteLength - (22 + 0xffff));
  let eocdOffset = -1;
  for (let offset = bytes.byteLength - 22; offset >= minimumEocdOffset; offset -= 1) {
    if (readUint32LE(bytes, offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) {
    failValidation("The Word (.docx) archive directory is missing.");
  }

  const diskNumber = readUint16LE(bytes, eocdOffset + 4);
  const centralDisk = readUint16LE(bytes, eocdOffset + 6);
  const entriesOnDisk = readUint16LE(bytes, eocdOffset + 8);
  const entryCount = readUint16LE(bytes, eocdOffset + 10);
  const centralSize = readUint32LE(bytes, eocdOffset + 12);
  const centralOffset = readUint32LE(bytes, eocdOffset + 16);
  const commentLength = readUint16LE(bytes, eocdOffset + 20);

  if (
    diskNumber !== 0 ||
    centralDisk !== 0 ||
    entriesOnDisk !== entryCount ||
    entryCount === 0 ||
    entryCount > MAX_DOCX_ENTRIES ||
    centralOffset + centralSize > eocdOffset ||
    eocdOffset + 22 + commentLength !== bytes.byteLength
  ) {
    failValidation("The Word (.docx) archive structure is invalid or too complex.");
  }

  const names = new Set<string>();
  let totalUncompressedBytes = 0;
  let offset = centralOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > eocdOffset || readUint32LE(bytes, offset) !== 0x02014b50) {
      failValidation("The Word (.docx) archive directory is invalid.");
    }

    const flags = readUint16LE(bytes, offset + 8);
    const method = readUint16LE(bytes, offset + 10);
    const compressedSize = readUint32LE(bytes, offset + 20);
    const uncompressedSize = readUint32LE(bytes, offset + 24);
    const nameLength = readUint16LE(bytes, offset + 28);
    const extraLength = readUint16LE(bytes, offset + 30);
    const entryCommentLength = readUint16LE(bytes, offset + 32);
    const nextOffset = offset + 46 + nameLength + extraLength + entryCommentLength;

    if (
      nextOffset > eocdOffset ||
      (flags & 0x01) !== 0 ||
      (method !== 0 && method !== 8) ||
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      uncompressedSize > MAX_DOCX_ENTRY_BYTES ||
      (uncompressedSize > 1024 * 1024 &&
        (compressedSize === 0 || uncompressedSize / compressedSize > MAX_DOCX_COMPRESSION_RATIO))
    ) {
      failValidation("The Word (.docx) archive contains an unsafe entry.");
    }

    totalUncompressedBytes += uncompressedSize;
    if (totalUncompressedBytes > MAX_DOCX_UNCOMPRESSED_BYTES) {
      failValidation("The expanded Word (.docx) file is too large.");
    }

    let name: string;
    try {
      name = new TextDecoder("utf-8", { fatal: true }).decode(
        bytes.subarray(offset + 46, offset + 46 + nameLength),
      );
    } catch {
      failValidation("The Word (.docx) archive contains an invalid entry name.");
    }
    names.add(name.replaceAll("\\", "/"));
    offset = nextOffset;
  }

  if (offset !== centralOffset + centralSize) {
    failValidation("The Word (.docx) archive directory length is invalid.");
  }
  if (!names.has("[Content_Types].xml") || !names.has("word/document.xml")) {
    failValidation("The archive is not a valid Word (.docx) document.");
  }
}

function decodeSafeText(bytes: Uint8Array) {
  let decoded: string;
  try {
    decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    failValidation("The text attachment is not valid UTF-8 text.");
  }

  const value = decoded.replace(/^\uFEFF/, "");
  if (value.includes("\0")) {
    failValidation("The text attachment contains binary data.");
  }

  let suspiciousControls = 0;
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0c && code !== 0x0d) {
      suspiciousControls += 1;
    }
  }
  if (suspiciousControls > Math.max(4, Math.floor(value.length / 100))) {
    failValidation("The text attachment contains too much binary control data.");
  }

  return value;
}

async function extractPdfText(bytes: Uint8Array) {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({
    data: Buffer.from(bytes),
    disableFontFace: true,
    enableXfa: false,
    isEvalSupported: false,
    maxImageSize: MAX_IMAGE_PIXELS,
    stopAtErrors: true,
    useSystemFonts: false,
    useWasm: false,
  });
  try {
    const result = await parser.getText({ first: MAX_PDF_PAGES_TO_EXTRACT });
    if (result.total > MAX_PDF_TOTAL_PAGES) {
      failValidation(`PDF attachments may contain at most ${MAX_PDF_TOTAL_PAGES} pages.`);
    }
    return sliceExtractedText(result.text || "");
  } catch (error) {
    if (error instanceof AttachmentFileValidationError) {
      throw error;
    }
    throw new AttachmentFileValidationError("This PDF file could not be read safely.");
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(bytes: Uint8Array) {
  try {
    const mammoth = (await import("mammoth")) as {
      extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }>;
    };
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return sliceExtractedText(result.value || "");
  } catch (error) {
    if (error instanceof AttachmentFileValidationError) {
      throw error;
    }
    throw new AttachmentFileValidationError("This Word (.docx) file could not be read safely.");
  }
}

export function resolveAttachmentDescriptor(fileName: string, mimeType?: string | null) {
  const rule = ATTACHMENT_TYPE_RULES.get(extensionOf(fileName));
  if (!rule) {
    return null;
  }

  const declaredMimeType = normalizedDeclaredMimeType(mimeType);
  if (declaredMimeType && !rule.acceptedMimeTypes.has(declaredMimeType)) {
    return null;
  }

  return {
    kind: rule.kind,
    mimeType: rule.canonicalMimeType,
  };
}

export function validateAttachmentContent(input: {
  fileName: string;
  kind: AttachmentKind;
  mimeType: string;
  bytes: Uint8Array;
}) {
  if (input.bytes.byteLength === 0) {
    failValidation("Empty attachments are not allowed.");
  }

  const descriptor = resolveAttachmentDescriptor(input.fileName, input.mimeType);
  if (
    !descriptor ||
    descriptor.kind !== input.kind ||
    descriptor.mimeType !== input.mimeType
  ) {
    failValidation("The attachment extension and content type do not match.");
  }

  if (input.kind === "IMAGE") {
    validateImageContent(input.mimeType, input.bytes);
    return;
  }
  if (input.kind === "PDF") {
    validatePdfContainer(input.bytes);
    return;
  }
  if (input.mimeType === WORD_DOCUMENT_MIME_TYPE) {
    validateDocxContainer(input.bytes);
    return;
  }

  const decoded = decodeSafeText(input.bytes);
  if (input.mimeType === "application/json") {
    try {
      JSON.parse(decoded);
    } catch {
      failValidation("The JSON attachment is not valid JSON.");
    }
  }
}

export function listAcceptedAttachmentTypes() {
  return ".txt,.md,.csv,.json,.docx,.pdf,image/png,image/jpeg,image/webp,image/gif";
}

export async function extractAttachmentTextContent(input: {
  kind: AttachmentKind;
  mimeType: string;
  bytes: Uint8Array;
}) {
  if (input.kind === "TEXT") {
    if (input.mimeType === WORD_DOCUMENT_MIME_TYPE) {
      return extractDocxText(input.bytes);
    }
    return sliceExtractedText(decodeSafeText(input.bytes));
  }

  if (input.kind === "PDF" && input.mimeType === "application/pdf") {
    return extractPdfText(input.bytes);
  }

  return null;
}

export { WORD_DOCUMENT_MIME_TYPE };
