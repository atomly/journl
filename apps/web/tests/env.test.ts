import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { createJiti } from "jiti";
import { expect, test } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(testDir, "../../../.env");
const envModulePath = resolve(testDir, "../src/env.ts");

test("validates root .env using app env schema", async () => {
  const result = loadEnv({ path: envPath });

  expect(result.error).toBeUndefined();

  const jiti = createJiti(import.meta.url);
  await expect(jiti.import(envModulePath)).resolves.toBeDefined();
});
