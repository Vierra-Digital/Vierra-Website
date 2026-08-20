import { defineConfig } from "vitest/config";
import path from "node:path";

// This file is .mts, not .ts, deliberately: it uses ESM syntax, and Vite loads a plain .ts config
// as CommonJS. That mismatch is unsupported by Vite's `configLoader: "native"`, which is becoming
// the default, and it warned on every test run. As ESM there is no __dirname, so the alias below
// uses import.meta.dirname (Node >= 20.11).

// Unit tests run against pure, import-safe modules only (no Next/Prisma/network). The "@/" alias
// mirrors tsconfig ("@/*": ["./*"]) so tests import the same paths the app does.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname) },
  },
  // Own the JSX transform here instead of inheriting tsconfig's "jsx".
  //
  // Next rewrites tsconfig.json's "jsx" to "preserve" on every build/lint (it compiles JSX
  // itself), so any value we commit that differs is reverted under us — and when the runner
  // relied on that setting, merely running a build left it with no transform and every test
  // importing a .tsx module failed with a confusing "Unexpected JSX expression".
  //
  // tsconfig now stores "preserve" to match what Next enforces (no more phantom diffs), and the
  // transform lives here, so the suite is independent of that file entirely.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "lcov"],
      // Scope coverage to the modules that actually have tests, so the threshold is a real gate on
      // tested code rather than diluted to ~0% by the whole app. Add files here as tests land.
      include: [
        "lib/contacts/spreadsheet.ts",
        "lib/email/trackerDetection.ts",
        "lib/api/parsing.ts",
        "lib/email/templateRender.ts",
        "lib/campaigns/mergeTags.ts",
        "lib/api/marketing.ts",
        // Added as their suites landed — the gate is only meaningful if it covers the modules we
        // actually test. Everything below has a dedicated tests/*.test.ts file.
        "lib/contacts/csv.ts",
        "lib/booking/slots.ts",
        "lib/api/emailTracking.ts",
        "lib/batch.ts",
        "lib/email/panelApi.ts",
        "lib/ga4Client.ts",
        "lib/gmail/dsn.ts",
        "lib/email/postmaster.ts",
      ],
      // Floor set below current levels (~93% stmts/branch, 100% funcs) with margin: passes today,
      // blocks regressions, raise further as tests grow.
      thresholds: {
        statements: 88,
        branches: 85,
        functions: 95,
        lines: 88,
      },
    },
  },
});
