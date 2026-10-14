import { defineConfig } from "vitest/config";
import base from "./vitest.config.ts";

export default defineConfig({
  ...base,
  test: {
    exclude: ["**/node_modules/**", "**/.next/**"],
    globalSetup: ["./src/testing/postgres-global-setup.ts"],
    include: ["src/**/*.integration.spec.{ts,tsx}"],
    maxWorkers: 2,
    testTimeout: 30000,
  },
});
