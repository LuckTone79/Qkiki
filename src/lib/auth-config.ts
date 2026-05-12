export function isPostgresUrl(url: string | null | undefined) {
  if (!url) {
    return false;
  }
  return url.startsWith("postgresql://") || url.startsWith("postgres://");
}

export function resolveDatabaseUrl() {
  const primary = process.env.DATABASE_URL?.trim();
  const fallback = process.env.POSTGRES_PRISMA_URL?.trim();

  if (isPostgresUrl(primary)) {
    return primary;
  }
  if (isPostgresUrl(fallback)) {
    return fallback;
  }
  return null;
}

export function getAuthRuntimeDiagnostics() {
  const databaseUrl = resolveDatabaseUrl();
  const googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() || "";
  const googleClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() || "";
  const appSecret = process.env.APP_SECRET?.trim() || "";

  return {
    databaseConfigured: Boolean(databaseUrl),
    googleOAuthConfigured: Boolean(googleClientId && googleClientSecret),
    appSecretConfigured: Boolean(appSecret),
  };
}
