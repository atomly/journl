import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: { "~": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    exclude: [
      "**/node_modules/**",
      "**/*.browser.spec.ts",
      "**/.next/**",
      "src/**/*.integration.spec.{ts,tsx}",
    ],
    include: ["src/**/*.spec.{ts,tsx}"],
  },
});
