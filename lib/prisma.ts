import { PrismaClient } from "@prisma/client";
import os from "os";

declare global {
  var prisma: PrismaClient | undefined;
}

// Runtime is capped to 1 connection so many concurrent serverless invocations can never exhaust
// Supabase's pool. `next build` is a single machine with no such fan-out, but it's not a single
// connection either: `next build` runs several static-generation WORKER PROCESSES concurrently
// (roughly one per CPU), and each worker gets its own PrismaClient — so `connection_limit` is a
// per-worker budget, not a build-wide one. A flat 8 here once multiplied out across the worker
// pool and blew straight past Supabase's session-pooler cap ("max clients reached ... pool_size:
// 15"). Instead, divide a build-wide budget across a pessimistic (CPU-count) estimate of the
// worker pool, so the worst-case total across every worker stays safely under that hard cap
// (15) with headroom for anything else already holding a connection (e.g. a running dev server).
// NEXT_PHASE is set by Next.js itself (phase-production-build during `next build`).
const BUILD_CONNECTION_BUDGET = 8;
const RUNTIME_CONNECTION_LIMIT = 1;

function buildConnectionLimit(): number {
  const estimatedWorkers = Math.max(1, os.cpus()?.length || 1);
  return Math.max(1, Math.floor(BUILD_CONNECTION_BUDGET / estimatedWorkers));
}

function getDatasourceUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  if (url.includes("connection_limit=")) return url;
  const limit = process.env.NEXT_PHASE === "phase-production-build" ? buildConnectionLimit() : RUNTIME_CONNECTION_LIMIT;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}connection_limit=${limit}`;
}

export const prisma =
  global.prisma ??
  new PrismaClient({
    datasources: { db: { url: getDatasourceUrl() } },
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
