import crypto from "crypto";

export type CipherBundle = {
  ciphertext: string;
  iv: string;
  tag: string;
};

type EncryptionKeySource =
  | "db_encryption_key"
  | "app_secret"
  | "dev_fallback";

type EncryptedSecret = {
  ciphertext: string;
  iv: string;
  tag: string;
  hint: string;
};

const algorithm = "aes-256-gcm";
const devFallbackSecret = "dev-only-change-before-production";

function toKey(secret: string) {
  return crypto.createHash("sha256").update(secret).digest();
}

function getPrimaryEncryptionSecret(): {
  secret: string;
  source: EncryptionKeySource;
} {
  const dbEncryptionKey = process.env.DB_ENCRYPTION_KEY?.trim();
  if (dbEncryptionKey) {
    return { secret: dbEncryptionKey, source: "db_encryption_key" };
  }

  const appSecret = process.env.APP_SECRET?.trim();
  if (appSecret) {
    return { secret: appSecret, source: "app_secret" };
  }

  return { secret: devFallbackSecret, source: "dev_fallback" };
}

function getDecryptionSecrets(): Array<{
  secret: string;
  source: EncryptionKeySource;
}> {
  const candidates: Array<{
    secret: string;
    source: EncryptionKeySource;
  }> = [];

  const dbEncryptionKey = process.env.DB_ENCRYPTION_KEY?.trim();
  if (dbEncryptionKey) {
    candidates.push({
      secret: dbEncryptionKey,
      source: "db_encryption_key",
    });
  }

  const appSecret = process.env.APP_SECRET?.trim();
  if (appSecret && appSecret !== dbEncryptionKey) {
    candidates.push({
      secret: appSecret,
      source: "app_secret",
    });
  }

  if (!candidates.length) {
    candidates.push({
      secret: devFallbackSecret,
      source: "dev_fallback",
    });
  }

  return candidates;
}

function encryptRaw(value: string): CipherBundle {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    algorithm,
    toKey(getPrimaryEncryptionSecret().secret),
    iv,
  );
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
  let lastError: Error | null = null;

  for (const candidate of getDecryptionSecrets()) {
    try {
      const decipher = crypto.createDecipheriv(
        algorithm,
        toKey(candidate.secret),
        Buffer.from(input.iv, "base64"),
      );
      decipher.setAuthTag(Buffer.from(input.tag, "base64"));
      const value = Buffer.concat([
        decipher.update(Buffer.from(input.ciphertext, "base64")),
        decipher.final(),
      ]).toString("utf8");

      return {
        value,
        keySource: candidate.source,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Decrypt failed.");
    }
  }

  throw lastError ?? new Error("Decrypt failed.");
}

export function decryptSecret(input: CipherBundle) {
  return decryptRaw(input).value;
}

export function decryptSecretWithMetadata(input: CipherBundle) {
  return decryptRaw(input);
}

export function encryptTextContent(value: string): CipherBundle {
  return encryptRaw(value);
}

export function decryptTextContent(input: CipherBundle) {
  return decryptRaw(input).value;
}

export function hasDedicatedDbEncryptionKey() {
  return Boolean(process.env.DB_ENCRYPTION_KEY?.trim());
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
