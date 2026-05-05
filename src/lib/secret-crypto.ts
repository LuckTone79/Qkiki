import crypto from "crypto";

export type CipherBundle = {
  ciphertext: string;
  iv: string;
  tag: string;
};

type EncryptedSecret = {
  ciphertext: string;
  iv: string;
  tag: string;
  hint: string;
};

const algorithm = "aes-256-gcm";

function getKey() {
  const secret = process.env.APP_SECRET ?? "dev-only-change-before-production";
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptRaw(value: string): CipherBundle {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function encryptSecret(value: string): EncryptedSecret {
  const encrypted = encryptRaw(value);

  return {
    ...encrypted,
    hint: value.length > 4 ? value.slice(-4) : "set",
  };
}

function decryptRaw(input: CipherBundle) {
  const decipher = crypto.createDecipheriv(
    algorithm,
    getKey(),
    Buffer.from(input.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(input.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(input.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function decryptSecret(input: CipherBundle) {
  return decryptRaw(input);
}

export function encryptTextContent(value: string): CipherBundle {
  return encryptRaw(value);
}

export function decryptTextContent(input: CipherBundle) {
  return decryptRaw(input);
}

export function maskApiKey(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length <= 8) {
    return `${"*".repeat(Math.max(trimmed.length - 2, 1))}${trimmed.slice(-2)}`;
  }
  return `${trimmed.slice(0, 4)}${"*".repeat(trimmed.length - 8)}${trimmed.slice(-4)}`;
}
