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
  warnOnSessionModePooler(url);
  if (url.includes("connection_limit=")) return url;
  const limit = process.env.NEXT_PHASE === "phase-production-build" ? buildConnectionLimit() : RUNTIME_CONNECTION_LIMIT;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}connection_limit=${limit}`;
}

/**
 * Supabase exposes two pooler ports on the same host: 6543 is transaction mode, 5432 is
 * session mode. Session mode pins a server connection for the life of each client and caps
 * the whole project at 15 of them, so a dev server plus a `next build` plus a script is
 * enough to exhaust it — at which point every query fails with
 * "FATAL: (EMAXCONNSESSION) max clients reached in session mode". Prisma should use the
 * transaction pooler (6543) with `pgbouncer=true`, which is what Supabase documents for it.
 * Warn rather than rewrite the URL: silently redirecting someone's database connection is
 * worse than telling them the port is wrong.
 */
function warnOnSessionModePooler(url: string) {
  if (process.env.NODE_ENV === "production") return;
  try {
    const parsed = new URL(url);
    const isSupabasePooler = parsed.hostname.includes("pooler.supabase.com");
    const isSessionModePort = parsed.port === "5432";
    if (isSupabasePooler && isSessionModePort) {
      console.warn(
        "[prisma] DATABASE_URL points at Supabase's SESSION-mode pooler (port 5432), which " +
          "caps the project at 15 connections and fails with EMAXCONNSESSION once they're " +
          "used. Prefer the transaction pooler: port 6543 with ?pgbouncer=true&connection_limit=1"
      );
    }
  } catch {
    /* an unparseable URL is Prisma's problem to report, not ours */
  }
}

export const prisma =
  global.prisma ??
  new PrismaClient({
    datasources: { db: { url: getDatasourceUrl() } },
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
