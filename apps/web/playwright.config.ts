import { defineConfig, devices } from "@playwright/test";

const { BROWSER_TEST_OPENAI_API_KEY, CI, PLAYWRIGHT_DESIGN_REVIEW } =
  // biome-ignore lint/style/noProcessEnv: Playwright runner flags are separate from app configuration.
  process.env;
const designReview = PLAYWRIGHT_DESIGN_REVIEW === "1";
const liveAI = Boolean(BROWSER_TEST_OPENAI_API_KEY);

export default defineConfig({
  expect: { timeout: 15_000 },
  // Mutating specs share seeded records within a server. Shard at file scope.
  fullyParallel: false,
  maxFailures: CI ? 0 : 1,
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-webkit", use: { ...devices["iPhone 13"] } },
  ],
  reporter: CI
    ? [["list"], ["json", { outputFile: "test-results/summary.json" }]]
    : [["list"], ["html", { open: "never" }]],
  testDir: "./src",
  testIgnore: designReview
    ? []
    : [
        "**/*.review.browser.spec.ts",
        ...(liveAI ? [] : ["**/*.live.browser.spec.ts"]),
      ],
  testMatch: designReview
    ? "**/*.review.browser.spec.ts"
    : "**/*.browser.spec.ts",
  timeout: 120_000,
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
    // This route returns 401 without a session and also compiles the shared API.
    url: "http://127.0.0.1:3100/api/trpc/tree.getChildrenPaginated",
  },
  workers: 1,
});
