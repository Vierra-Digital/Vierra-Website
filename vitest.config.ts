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
  },
});
