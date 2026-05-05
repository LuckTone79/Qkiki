import { PrismaClient } from "@prisma/client";

const fallbackDatabaseUrl = process.env.POSTGRES_PRISMA_URL?.trim();
const currentDatabaseUrl = process.env.DATABASE_URL?.trim();

if (
  (!currentDatabaseUrl || currentDatabaseUrl.length === 0) &&
  fallbackDatabaseUrl
) {
  process.env.DATABASE_URL = fallbackDatabaseUrl;
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
