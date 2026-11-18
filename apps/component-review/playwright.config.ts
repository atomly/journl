import { randomInt } from "node:crypto";
import { createServer } from "node:net";
import { defineConfig } from "@playwright/test";

// An externally supplied review stays user-owned. Otherwise Playwright owns
// a disposable Storybook server and stops it after acceptance checks.
async function availableReviewPort() {
  for (;;) {
    const port = randomInt(49152, 65536);
    const probe = createServer();
    try {
      await new Promise<void>((resolve, reject) => {
        probe.once("error", reject);
        probe.listen(port, "0.0.0.0", resolve);
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EADDRINUSE") continue;
      throw error;
    }
    await new Promise<void>((resolve, reject) => {
      probe.close((error) => (error ? reject(error) : resolve()));
    });
    return port;
  }
}

const externalUrl = process.env.COMPONENT_REVIEW_URL;
// Workers evaluate the config again; inherit the runner's chosen address.
const inheritedUrl = externalUrl ?? process.env.COMPONENT_REVIEW_TEST_URL;
const port = inheritedUrl
  ? new URL(inheritedUrl).port
  : await availableReviewPort();
const baseURL = inheritedUrl ?? `http://127.0.0.1:${port}`;
process.env.COMPONENT_REVIEW_TEST_URL = baseURL;

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
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: externalUrl
    ? undefined
    : {
        command: `pnpm dev --host 0.0.0.0 --port ${port} --ci`,
        gracefulShutdown: { signal: "SIGTERM", timeout: 30_000 },
        reuseExistingServer: false,
        timeout: 120_000,
        url: baseURL,
      },
  workers: 2,
});
