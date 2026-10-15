import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  expect: { timeout: 15_000 },
  fullyParallel: false,
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-webkit", use: { ...devices["iPhone 13"] } },
  ],
  reporter: [["list"], ["html", { open: "never" }]],
  testDir: "./src",
  testMatch: "**/*.browser.spec.ts",
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:3100",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm exec jiti src/testing/browser/server.ts",
    gracefulShutdown: { signal: "SIGTERM", timeout: 30_000 },
    reuseExistingServer: false,
    timeout: 240_000,
    url: "http://127.0.0.1:3100",
  },
  workers: 1,
});
