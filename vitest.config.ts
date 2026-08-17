import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests run against pure, import-safe modules only (no Next/Prisma/network). The "@/" alias
// mirrors tsconfig ("@/*": ["./*"]) so tests import the same paths the app does.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
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
