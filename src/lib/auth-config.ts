export function isDatabaseUrl(url: string | null | undefined) {
  if (!url) {
    return false;
  }
  return (
    url.startsWith("postgresql://") ||
    url.startsWith("postgres://") ||
    url.startsWith("prisma://") ||
    url.startsWith("prisma+postgres://")
  );
}

export function resolveDatabaseUrl() {
  const primary = process.env.DATABASE_URL?.trim();
  const fallback = process.env.POSTGRES_PRISMA_URL?.trim();

  if (isDatabaseUrl(primary)) {
    return primary;
  }
  if (isDatabaseUrl(fallback)) {
    return fallback;
  }
  return null;
}

export function getAuthRuntimeDiagnostics() {
  const databaseUrl = resolveDatabaseUrl();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || "";
  const appSecret = process.env.APP_SECRET?.trim() || "";

  return {
    databaseConfigured: Boolean(databaseUrl),
    supabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey),
    supabaseServiceRoleConfigured: Boolean(supabaseServiceRoleKey),
    turnstileConfigured: Boolean(turnstileSiteKey),
    appSecretConfigured: Boolean(appSecret),
  };
}
