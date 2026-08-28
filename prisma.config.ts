import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 moved CLI configuration out of the schema and into this file. `url`, `directUrl` and
 * `shadowDatabaseUrl` are no longer read from the datasource block, so the connection the CLI uses
 * for migrations and introspection is configured here instead.
 *
 * Prisma 7 also stops loading .env automatically, hence the `dotenv/config` import above. The app
 * itself is unaffected — Next loads .env on its own.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Schema work should go over a direct connection rather than the pooler, which is what
    // DIRECT_URL is for. It falls back to DATABASE_URL so that every migrate/db-pull/studio command
    // still runs when only DATABASE_URL is set — under Prisma 6 an unset DIRECT_URL failed every
    // one of them with a confusing P1012 "Environment variable not found" that read like a schema
    // error rather than missing configuration.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
});
