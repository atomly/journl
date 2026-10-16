import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { arch, availableParallelism, platform } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "@playwright/test";
import { createServer } from "vite";
import type { InventoryScenario } from "./types";

const directory = dirname(fileURLToPath(import.meta.url));
const workspace = resolve(directory, "../../../../..");
const runsArgument = process.argv.find((value) => value.startsWith("--runs="));
const runs = runsArgument ? Number(runsArgument.split("=")[1]) : 5;
if (!Number.isInteger(runs) || runs < 3)
  throw new Error("Use at least three mount samples");
const browserArgument = process.argv
  .find((value) => value.startsWith("--browser="))
  ?.split("=")[1];
if (browserArgument && !["chromium", "webkit"].includes(browserArgument))
  throw new Error("Expected --browser=chromium or --browser=webkit");
const outputArgument = process.argv
  .find((value) => value.startsWith("--output="))
  ?.slice("--output=".length);
const output = outputArgument
  ? resolve(outputArgument)
  : resolve(workspace, "docs/editor-inventory/baseline.json");
const percentile = (values: number[], fraction: number) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return (
    Math.round(
      (sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0) * 100,
    ) / 100
  );
};
const sourceFiles = [
  "packages/blocknote/src/inventory/fixtures.ts",
  "packages/blocknote/src/blocknote-schema.ts",
  "packages/blocknote/src/reference-read-only.tsx",
  "pnpm-lock.yaml",
  "apps/web/src/components/editor/block-editor.tsx",
  "apps/web/src/components/editor/block-editor-utils.ts",
  "apps/web/src/app/styles.css",
  "apps/web/src/app/styles/blocknote.css",
  "apps/web/src/testing/editor-inventory/run.ts",
  "apps/web/src/testing/editor-inventory/theme.ts",
  "apps/web/src/testing/editor-inventory/types.ts",
  "apps/web/src/testing/editor-inventory/style.css",
  "apps/web/src/components/editor/use-block-editor.ts",
  "apps/web/src/testing/editor-inventory/client.tsx",
];
const sources = Object.fromEntries(
  await Promise.all(
    sourceFiles.map(async (path) => [
      path,
      createHash("sha256")
        .update(await readFile(resolve(workspace, path)))
        .digest("hex"),
    ]),
  ),
);
const browsers = [
  {
    mobile: false,
    name: "chromium",
    type: chromium,
    viewport: { height: 900, width: 1440 },
  },
  {
    mobile: true,
    name: "webkit",
    type: webkit,
    viewport: { height: 844, width: 390 },
  },
].filter((browser) => !browserArgument || browser.name === browserArgument);
const scenarios: InventoryScenario[] = [
  { blocks: 50, surface: "page" },
  { blocks: 500, surface: "page" },
  { blocks: 2000, surface: "page" },
  { blocks: 200, surface: "references" },
  { blocks: 10, surface: "entries" },
  { blocks: 50, surface: "timeline" },
  { blocks: 0, surface: "preview" },
];
const server = await createServer({
  cacheDir: resolve(workspace, "node_modules/.cache/editor-inventory"),
  configFile: false,
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: [
      { find: "~/env", replacement: resolve(directory, "environment.ts") },
      { find: "next-themes", replacement: resolve(directory, "theme.ts") },
      {
        find: "next/navigation",
        replacement: resolve(directory, "navigation.ts"),
      },
      { find: "~", replacement: resolve(workspace, "apps/web/src") },
    ],
  },
  root: directory,
  server: {
    fs: { allow: [workspace] },
    host: "127.0.0.1",
    port: 3209,
    strictPort: true,
  },
});
const measurements: unknown[] = [];
let completed = false;
let failure: string | null = null;
try {
  await server.listen();
  for (const browserSpec of browsers) {
    const browser = await browserSpec.type.launch();
    try {
      const page = await browser.newPage({
        hasTouch: browserSpec.mobile,
        isMobile: browserSpec.mobile,
        viewport: browserSpec.viewport,
      });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/*", (route) =>
        route.request().url().startsWith("http://127.0.0.1:3209/")
          ? route.continue()
          : route.abort(),
      );
      await page.goto("http://127.0.0.1:3209");
      await page.waitForFunction(() => Boolean(window.editorInventory), {
        timeout: 120000,
      });
      for (const scenario of scenarios) {
        await page.reload();
        await page.waitForFunction(() => Boolean(window.editorInventory));
        // Prime modules/fonts once. Mount samples exclude bundling, network, auth and SQL.
        await page.evaluate(
          (input) => window.editorInventory.mount(input),
          scenario,
        );
        const mounts = [];
        for (let index = 0; index < runs; index++)
          mounts.push(
            await page.evaluate(
              (input) => window.editorInventory.mount(input),
              scenario,
            ),
          );
        const editor = page
          .locator('.bn-editor[contenteditable="true"]')
          .first();
        if (scenario.surface !== "preview") {
          await editor.click();
          await page.keyboard.press("ControlOrMeta+Home");
          // Real beforeinput -> next animation-frame samples include Journl's transaction diff.
          await page.keyboard.type(
            "Baseline typing preserves writing. 123456",
            { delay: 30 },
          );
          await page.waitForTimeout(100);
        }
        if (
          scenario.surface !== "preview" &&
          !(await editor.textContent())?.includes(
            "Baseline typing preserves writing. 123456",
          )
        )
          throw new Error("Typed content was not retained");
        const typing = await page.evaluate(() => ({
          samples: window.editorInventory.samples,
          transactions: window.editorInventory.transactions,
        }));
        if (
          scenario.surface !== "preview" &&
          (typing.samples.length < 40 || typing.transactions === 0)
        )
          throw new Error(
            "Typing samples or real transaction generation missing",
          );
        if (
          (scenario.surface === "page" || scenario.surface === "references") &&
          mounts.some((sample) => sample.renderedBlocks !== scenario.blocks)
        )
          throw new Error("A document block was omitted from the benchmark");
        const scrolling = await page.evaluate(async () => {
          const element = document.querySelector<HTMLElement>(
            "[data-scroll], [data-virtuoso-scroller]",
          );
          if (!element) throw new Error("Missing benchmark scroll container");
          const frames: number[] = [];
          let previous = await new Promise<number>((done) =>
            requestAnimationFrame(done),
          );
          for (let index = 0; index < 120; index++) {
            element.scrollTop = index < 60 ? index * 100 : (120 - index) * 100;
            const timestamp = await new Promise<number>((done) =>
              requestAnimationFrame(done),
            );
            frames.push(Math.round((timestamp - previous) * 100) / 100);
            previous = timestamp;
          }
          return {
            mountedEditors: document.querySelectorAll(
              '.bn-editor[contenteditable="true"]',
            ).length,
            over50Ms: frames.filter((value) => value > 50).length,
            p95FrameMs: frames.sort((a, b) => a - b)[
              Math.ceil(frames.length * 0.95) - 1
            ],
            samples: frames.length,
          };
        });
        if (errors.length)
          throw new Error(`Browser errors: ${errors.join("; ")}`);
        const result = {
          browser: browserSpec.name,
          browserVersion: browser.version(),
          mount: {
            lastSample: mounts.at(-1),
            medianMs: percentile(
              mounts.map((sample) => sample.milliseconds),
              0.5,
            ),
            p95Ms: percentile(
              mounts.map((sample) => sample.milliseconds),
              0.95,
            ),
            samples: runs,
          },
          scenario,
          scrolling,
          typing: {
            p95Ms: percentile(typing.samples, 0.95),
            samples: typing.samples.length,
            transactions: typing.transactions,
          },
          viewport: browserSpec.viewport,
        };
        measurements.push(result);
        process.stdout.write(`${JSON.stringify(result)}\n`);
      }
    } finally {
      await browser.close();
    }
  }
  completed = true;
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
  throw error;
} finally {
  await server.close();
  const version = JSON.parse(
    await readFile(
      resolve(workspace, "node_modules/@blocknote/core/package.json"),
      "utf8",
    ),
  ).version;
  await writeFile(
    output,
    `${JSON.stringify({ completed, environment: { arch: arch(), blocknote: version, node: process.version, parallelism: availableParallelism(), platform: platform() }, failure, formatVersion: 1, measurements, recordedAt: new Date().toISOString(), requestedBrowsers: browsers.map((browser) => browser.name), scope: "Isolated installed Journl editor + transaction diff; development React; fake local references; no Next/auth/SQL/AI/network latency or real-device keyboard", sources }, null, 2)}\n`,
  );
  process.stdout.write(`Baseline written to ${output}\n`);
}
