import { execSync } from "node:child_process";

const env = process.env.VERCEL_ENV || process.env.NODE_ENV;
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
const hasDirectUrl = Boolean(process.env.DIRECT_URL?.trim());

if (env === "production") {
  if (!hasDatabaseUrl || !hasDirectUrl) {
    console.error(
      "[prebuild] DATABASE_URL and DIRECT_URL are required in production.",
    );
    process.exit(1);
  }

  console.log("[prebuild] Running prisma migrate deploy for production...");
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
  console.log("[prebuild] Verifying required workbench schema...");
  execSync("node scripts/assert-workbench-run-schema.mjs", { stdio: "inherit" });
} else {
  console.log("[prebuild] Skipping prisma migrate deploy outside production.");
}
