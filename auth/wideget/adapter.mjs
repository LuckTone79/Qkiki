// This file belongs to Yapp after Login Kit init.
// Keep the app's auth-engine client, server-only secrets, database mapping,
// and domain policy here. It must remain server-only by import convention.

const SUPABASE_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const YAPP_APP_ID = 'net.wideget.yapp';

export function assertYappAuthSubject(subject) {
  if (typeof subject !== 'string' || !SUPABASE_UUID_PATTERN.test(subject)) {
    const error = new Error('Yapp auth subjects must be verified Supabase UUIDs.');
    error.code = 'INVALID_SUBJECT';
    throw error;
  }
  return subject;
}

export function getYappAuthIssuer(env = globalThis.process?.env ?? {}) {
  const rawUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!rawUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required to build the Yapp issuer.');
  }
  const url = new URL(rawUrl);
  return `${url.origin}/auth/v1`;
}

export function createYappVerifiedIdentity({
  subject,
  appUserId,
  methods,
  assurance = 'unknown',
  sessionId,
  verifiedAt = new Date().toISOString()
}) {
  assertYappAuthSubject(subject);
  if (typeof appUserId !== 'string' || appUserId.trim().length === 0) {
    throw new Error('Yapp appUserId must be a non-empty Prisma user ID.');
  }
  if (!Array.isArray(methods) || methods.length === 0) {
    throw new Error('Yapp verified identities must declare a login method.');
  }
  return {
    schemaVersion: 1,
    appId: YAPP_APP_ID,
    issuer: getYappAuthIssuer(),
    subject,
    appUserId,
    ...(sessionId ? { sessionId } : {}),
    assurance,
    methods: [...methods],
    verifiedAt
  };
}

export function createIdentityLinkConflictError({ subject, candidateSubject }) {
  const error = new Error('The verified Supabase identity conflicts with another Yapp account.');
  error.code = 'IDENTITY_LINK_CONFLICT';
  error.subject = subject;
  error.candidateSubject = candidateSubject;
  return error;
}

export async function verifyAppOwnedSession({
  accessToken,
  verifyWithAuthEngine,
  mapSubjectToAppUserId
}) {
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new Error('An access token is required for server-side verification.');
  }
  if (typeof verifyWithAuthEngine !== 'function' || typeof mapSubjectToAppUserId !== 'function') {
    throw new Error('The consumer must provide auth-engine verification and its immutable-ID mapper.');
  }

  const engineIdentity = await verifyWithAuthEngine(accessToken);
  assertYappAuthSubject(engineIdentity.subject);
  const appUserId = await mapSubjectToAppUserId({
    issuer: engineIdentity.issuer,
    subject: engineIdentity.subject
  });

  return createYappVerifiedIdentity({
    subject: engineIdentity.subject,
    appUserId,
    assurance: engineIdentity.assurance ?? 'unknown',
    methods: engineIdentity.methods,
    verifiedAt: new Date().toISOString()
  });
}
