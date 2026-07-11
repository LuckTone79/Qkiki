import crypto from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function decodeBase32(value: string) {
  const normalized = value.toUpperCase().replace(/[\s=-]/g, "");
  if (!normalized || /[^A-Z2-7]/.test(normalized)) {
    throw new Error("TOTP secret is not valid Base32.");
  }

  let bits = "";
  for (const character of normalized) {
    bits += BASE32_ALPHABET.indexOf(character).toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

export function totpSecretByteLength(secret: string) {
  return decodeBase32(secret).length;
}

export function generateTotp(
  secret: string,
  options?: { now?: number; digits?: number; periodSeconds?: number },
) {
  const digits = options?.digits ?? 6;
  const periodSeconds = options?.periodSeconds ?? 30;
  const counter = Math.floor((options?.now ?? Date.now()) / 1000 / periodSeconds);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const digest = crypto
    .createHmac("sha1", decodeBase32(secret))
    .update(counterBuffer)
    .digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    (digest.readUInt32BE(offset) & 0x7fffffff) % Math.pow(10, digits);
  return code.toString().padStart(digits, "0");
}

function timingSafeTextEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function verifyTotp(
  providedCode: string,
  secret: string,
  options?: { now?: number; window?: number },
) {
  if (!/^\d{6}$/.test(providedCode)) {
    return false;
  }

  const now = options?.now ?? Date.now();
  const window = options?.window ?? 1;
  let matched = false;
  for (let offset = -window; offset <= window; offset += 1) {
    const expected = generateTotp(secret, { now: now + offset * 30_000 });
    matched = timingSafeTextEquals(providedCode, expected) || matched;
  }
  return matched;
}
