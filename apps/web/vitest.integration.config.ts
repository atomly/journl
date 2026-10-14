import { defineConfig } from "vitest/config";
import base from "./vitest.config.ts";

export default defineConfig({
  ...base,
  test: {
    exclude: ["**/node_modules/**", "**/.next/**"],
    include: ["tests/integration/**/*.test.ts"],
    maxWorkers: 2,
    testTimeout: 30000,
  },
});
