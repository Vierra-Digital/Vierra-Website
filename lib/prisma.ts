import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import os from "os";

declare global {
  var prisma: PrismaClient | undefined;
}

// Runtime is capped to 1 connection so many concurrent serverless invocations can never exhaust
// Supabase's pool. `next build` is a single machine with no such fan-out, but it's not a single
// connection either: `next build` runs several static-generation WORKER PROCESSES concurrently
// (roughly one per CPU), and each worker gets its own PrismaClient — so the cap is a per-worker
// budget, not a build-wide one. A flat 8 here once multiplied out across the worker pool and blew
// straight past Supabase's session-pooler cap ("max clients reached ... pool_size: 15"). Instead,
// divide a build-wide budget across a pessimistic (CPU-count) estimate of the worker pool, so the
// worst-case total across every worker stays safely under that hard cap (15) with headroom for
// anything else already holding a connection (e.g. a running dev server).
// NEXT_PHASE is set by Next.js itself (phase-production-build during `next build`).
const BUILD_CONNECTION_BUDGET = 8;
const RUNTIME_CONNECTION_LIMIT = 1;

function buildConnectionLimit(): number {
  const estimatedWorkers = Math.max(1, os.cpus()?.length || 1);
  return Math.max(1, Math.floor(BUILD_CONNECTION_BUDGET / estimatedWorkers));
}

function connectionLimit(): number {
  return process.env.NEXT_PHASE === "phase-production-build"
    ? buildConnectionLimit()
    : RUNTIME_CONNECTION_LIMIT;
}

function datasourceUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  warnOnSessionModePooler(url);
  return url;
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

/**
 * Prisma 7 requires a driver adapter, so the pool is now node-postgres rather than Prisma's own
 * Rust engine. The budget above is unchanged in intent but is expressed as the pg pool's `max`
 * instead of a `connection_limit` query parameter — the parameter was only ever read by the engine
 * that no longer exists here, so leaving it in the URL would have silently stopped capping
 * anything.
 *
 * Constructed lazily, on first property access, so that merely importing this module has no side
 * effects. It used to build the client (and throw on a missing DATABASE_URL) at import time, which
 * meant any module anywhere in the import graph of a unit test needed a live database URL just to
 * be loaded — two suites failed to collect for exactly that reason. Nothing about the singleton
 * behaviour changes: the same instance is reused, and it is still cached on `global` outside
 * production so hot reload doesn't leak connections.
 */
let client: PrismaClient | undefined;

function getClient(): PrismaClient {
  if (client) return client;
  if (global.prisma) {
    client = global.prisma;
    return client;
  }
  client = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: datasourceUrl(),
      max: connectionLimit(),
    }),
  });
  if (process.env.NODE_ENV !== "production") global.prisma = client;
  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const instance = getClient() as unknown as Record<string | symbol, unknown>;
    const value = instance[prop];
    // Model delegates are plain objects, but $transaction/$connect and friends are methods that
    // must stay bound to the real client.
    return typeof value === "function" ? value.bind(instance) : value;
  },
  has(_target, prop) {
    return prop in (getClient() as unknown as object);
  },
});
