import { defineConfig } from "@playwright/test";

export default defineConfig({
  fullyParallel: true,
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    {
      name: "forced-colors",
      use: {
        browserName: "chromium",
        forcedColors: "active",
        reducedMotion: "reduce",
      },
    },
  ],
  reporter: "list",
  testDir: "./tests",
  use: {
    baseURL: process.env.COMPONENT_REVIEW_URL ?? "http://127.0.0.1:57381",
    trace: "retain-on-failure",
  },
  workers: 2,
});
