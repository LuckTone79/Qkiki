import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

function printHelp() {
  console.log(`Usage:
  node scripts/migrate-legacy-users-to-supabase.mjs [--send] [--limit N]

Migrates existing "User" rows (the old passwordHash-based accounts) onto
Supabase Auth so they can sign in through the new system. For each user not
yet linked (User.supabaseUserId IS NULL), this:

  1. Creates a matching auth.users row via the Supabase Admin API, with the
     email pre-confirmed (it was already verified under the old system).
  2. Sends a Supabase "invite" email with a link to set a new password.
  3. Stamps User.supabaseUserId so the account is already linked by the time
     they click through — no separate lookup-by-email step needed.

Without --send this only prints what would happen (dry run): no accounts
are created, no emails are sent.

Options:
  --send       Actually create accounts and send invite emails.
  --limit N    Only process the first N unmigrated users (stage the rollout
               to stay under Supabase's email rate limit — see
               docs/AUTH_SETUP.md).
  --help       Show this help message.
`);
}

function parseArgs(argv) {
  const parsed = { send: false, limit: null, help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current === "--help" || current === "-h") {
      parsed.help = true;
      continue;
    }
    if (current === "--send") {
      parsed.send = true;
      continue;
    }
    if (current === "--limit") {
      parsed.limit = Number(argv[index + 1]);
      index += 1;
    }
  }

  return parsed;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const contents = fs.readFileSync(filePath, "utf8");
  const lines = contents.split(/\r?\n/u);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (!key || process.env[key]) {
      continue;
    }

    const normalized =
      value.startsWith('"') && value.endsWith('"')
        ? value.slice(1, -1)
        : value.startsWith("'") && value.endsWith("'")
          ? value.slice(1, -1)
          : value;

    process.env[key] = normalized;
  }
}

function loadEnvironment() {
  const root = process.cwd();
  const candidates = [
    path.join(root, ".env.production.local"),
    path.join(root, ".env.local"),
    path.join(root, ".env"),
  ];

  for (const candidate of candidates) {
    loadEnvFile(candidate);
  }

  const fallbackDatabaseUrl = process.env.POSTGRES_PRISMA_URL?.trim();
  const currentDatabaseUrl = process.env.DATABASE_URL?.trim();
  const usesPostgresProtocol =
    currentDatabaseUrl?.startsWith("postgresql://") ||
    currentDatabaseUrl?.startsWith("postgres://");

  if ((!currentDatabaseUrl || !usesPostgresProtocol) && fallbackDatabaseUrl) {
    process.env.DATABASE_URL = fallbackDatabaseUrl;
  }
}

function getNormalizedDatabaseUrl() {
  const rawDatabaseUrl = process.env.DATABASE_URL?.trim();
  if (!rawDatabaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const normalized = new URL(rawDatabaseUrl);
  normalized.searchParams.delete("sslmode");
  return normalized.toString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  loadEnvironment();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to run this migration.",
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const client = new pg.Client({
    connectionString: getNormalizedDatabaseUrl(),
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    const limitClause = Number.isFinite(args.limit) && args.limit > 0 ? ` LIMIT ${args.limit}` : "";
    const result = await client.query(
      `SELECT "id", "email", "name" FROM "User" WHERE "supabaseUserId" IS NULL ORDER BY "createdAt" ASC${limitClause}`,
    );

    console.log(`${result.rows.length} legacy user(s) not yet linked to Supabase Auth.`);

    if (!args.send) {
      console.log("Dry run only — pass --send to actually create accounts and email them.\n");
      for (const row of result.rows) {
        console.log(`  - ${row.email}`);
      }
      return;
    }

    const redirectTo = `${process.env.CANONICAL_APP_URL?.trim() || "https://yapp.wideget.net"}/auth/callback?next=/reset-password`;
    let migrated = 0;
    let failed = 0;

    for (const row of result.rows) {
      try {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: row.email,
          email_confirm: true,
          user_metadata: row.name ? { display_name: row.name } : undefined,
        });

        if (error || !data.user) {
          throw error ?? new Error("createUser returned no user.");
        }

        await client.query('UPDATE "User" SET "supabaseUserId" = $1 WHERE "id" = $2', [
          data.user.id,
          row.id,
        ]);

        const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
          row.email,
          { redirectTo },
        );

        if (inviteError) {
          console.warn(
            `  ! ${row.email}: account created but invite email failed (${inviteError.message}). Retry the invite later, or they can use "Forgot password" once one is sent.`,
          );
        } else {
          console.log(`  + ${row.email}: migrated and invited.`);
        }

        migrated += 1;
      } catch (error) {
        failed += 1;
        console.error(`  x ${row.email}: ${error instanceof Error ? error.message : error}`);
      }

      // Be gentle with Supabase's mailer rate limit (see docs/AUTH_SETUP.md).
      await sleep(500);
    }

    console.log(`\nDone. Migrated ${migrated}, failed ${failed}.`);
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error("");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
