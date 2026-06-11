// The documented DATABASE_URL pattern used connection_limit=1, which gives
// each runtime instance a single pooled connection. A parallel run multiplies
// concurrent queries (lease acquisition, cancellation polling, result writes,
// status polling) through that one connection, so every other query — even
// page-render auth lookups — queues behind it and the app appears to hang.
// Raise the floor to a small serverless-safe pool unless the operator opted
// into an explicit value of 2 or more.
const DEFAULT_SERVERLESS_CONNECTION_LIMIT = 5;

export function applyConnectionPoolDefaults(
  databaseUrl: string,
  env: Record<string, string | undefined> = process.env,
) {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    return databaseUrl;
  }

  const override = Number.parseInt(env.PRISMA_CONNECTION_LIMIT || "", 10);
  const current = Number.parseInt(
    parsed.searchParams.get("connection_limit") || "",
    10,
  );

  if (Number.isFinite(override) && override > 0) {
    parsed.searchParams.set("connection_limit", String(override));
    return parsed.toString();
  }

  if (!Number.isFinite(current) || current <= 1) {
    parsed.searchParams.set(
      "connection_limit",
      String(DEFAULT_SERVERLESS_CONNECTION_LIMIT),
    );
    return parsed.toString();
  }

  return databaseUrl;
}
