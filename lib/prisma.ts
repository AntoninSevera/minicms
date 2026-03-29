import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

const hasValidDatabaseUrl = () => {
  const databaseUrl = process.env.DATABASE_URL;
  return Boolean(databaseUrl && /^(postgresql|postgres):\/\//.test(databaseUrl));
};

const createPrismaClient = () => {
  if (!hasValidDatabaseUrl()) {
    return undefined;
  }

  try {
    return new PrismaClient();
  } catch {
    return undefined;
  }
};

const prismaClient = globalThis.prisma ?? createPrismaClient();

export const prisma =
  prismaClient ??
  (new Proxy(
    {},
    {
      get() {
        throw new Error("Prisma client is unavailable because DATABASE_URL is missing or invalid.");
      },
    },
  ) as PrismaClient);

if (process.env.NODE_ENV !== "production" && prismaClient) {
  globalThis.prisma = prismaClient;
}
