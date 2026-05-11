import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import bcrypt from "bcryptjs";
import pg from "pg";

function printHelp() {
  console.log(`Usage:
  npm run user:reset-password -- --email you@example.com

Options:
  --email   Email address of the user whose password should be reset
  --help    Show this help message
`);
}

function parseArgs(argv) {
  const parsed = {
    email: "",
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current === "--help" || current === "-h") {
      parsed.help = true;
      continue;
    }

    if (current === "--email") {
      parsed.email = argv[index + 1] ?? "";
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

async function promptForPassword() {
  process.stdout.write("New password: ");

  const originalRawMode = input.isTTY ? input.isRaw : false;
  let password = "";

  if (input.isTTY) {
    input.setRawMode(true);
  }

  return await new Promise((resolve, reject) => {
    const handleData = (chunk) => {
      const value = chunk.toString("utf8");

      if (value === "\u0003") {
        cleanup();
        reject(new Error("Password reset cancelled."));
        return;
      }

      if (value === "\r" || value === "\n") {
        cleanup();
        process.stdout.write("\n");
        resolve(password);
        return;
      }

      if (value === "\u007f" || value === "\b") {
        password = password.slice(0, -1);
        return;
      }

      password += value;
    };

    const cleanup = () => {
      input.off("data", handleData);
      if (input.isTTY) {
        input.setRawMode(Boolean(originalRawMode));
      }
    };

    input.on("data", handleData);
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  loadEnvironment();

  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is not configured. Load your production or local env first.");
  }

  const rl = createInterface({ input, output });
  const email =
    args.email.trim() ||
    (await rl.question("Email: ")).trim().toLowerCase();

  if (!email) {
    rl.close();
    throw new Error("Email is required.");
  }

  const password = await promptForPassword();

  if (password.length < 8) {
    rl.close();
    throw new Error("Password must be at least 8 characters long.");
  }

  const confirmation = await rl.question("Reset this user's password now? (yes/no): ");
  rl.close();

  if (confirmation.trim().toLowerCase() !== "yes") {
    throw new Error("Password reset cancelled.");
  }

  const client = new pg.Client({
    connectionString: getNormalizedDatabaseUrl(),
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    const userResult = await client.query(
      'SELECT "id", "email", "role", "status" FROM "User" WHERE "email" = $1 LIMIT 1',
      [email],
    );

    const user = userResult.rows[0];

    if (!user) {
      throw new Error(`No user found for ${email}.`);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await client.query("BEGIN");
    await client.query(
      'UPDATE "User" SET "passwordHash" = $1 WHERE "id" = $2',
      [passwordHash, user.id],
    );
    await client.query(
      'DELETE FROM "AuthSession" WHERE "userId" = $1',
      [user.id],
    );
    await client.query(
      'DELETE FROM "AdminSession" WHERE "userId" = $1',
      [user.id],
    );
    await client.query("COMMIT");

    console.log("");
    console.log("Password reset completed.");
    console.log(`Email: ${user.email}`);
    console.log(`Role: ${user.role}`);
    console.log(`Status: ${user.status}`);
    console.log("Existing user and admin sessions were cleared.");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    throw error;
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error("");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
