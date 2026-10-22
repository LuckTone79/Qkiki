export type IdentityLinkErrorCode =
  | "IDENTITY_LINK_CONFLICT"
  | "IDENTITY_EMAIL_REQUIRED";

export class IdentityLinkError extends Error {
  readonly code: IdentityLinkErrorCode;

  constructor(code: IdentityLinkErrorCode, message: string) {
    super(message);
    this.name = "IdentityLinkError";
    this.code = code;
  }
}

/**
 * Existing Prisma ownership is immutable. A verified Supabase subject can
 * link an unlinked legacy row or revisit its own row, but never take over a
 * row already owned by another subject.
 */
export function assertIdentityLinkMayProceed(
  existingSubject: string | null | undefined,
  verifiedSubject: string,
) {
  if (existingSubject && existingSubject !== verifiedSubject) {
    throw new IdentityLinkError(
      "IDENTITY_LINK_CONFLICT",
      "The verified Supabase identity conflicts with an existing Yapp account.",
    );
  }

  return existingSubject ? "already-linked" : "link-required";
}

export function requireLegacyEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) {
    throw new IdentityLinkError(
      "IDENTITY_EMAIL_REQUIRED",
      "This login provider did not return an email address required by the Yapp account bridge.",
    );
  }
  return normalized;
}
