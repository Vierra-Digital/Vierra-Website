import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

function getDatasourceUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return url;
  if (url.includes("connection_limit=")) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}connection_limit=1`;
}

export const prisma =
  global.prisma ??
  new PrismaClient({
    datasources: { db: { url: getDatasourceUrl() } },
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
