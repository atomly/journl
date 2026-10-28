import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
test("registry includes the full local import graph without private workspace imports or tests", async () => {
  execFileSync(process.execPath, ["scripts/build-editor-registry.mjs"], {
    cwd: root,
  });
  const registry = JSON.parse(
    await readFile(`${root}/apps/web/public/r/registry.json`, "utf8"),
  );
  assert.deepEqual(registry.items.map((item) => item.name).sort(), [
    "openeditor",
    "openeditor-document",
    "openeditor-references",
    "openeditor-ui",
  ]);
  const basenames = registry.items.flatMap((item) =>
    item.files.map((file) => file.path.split("/").at(-1)),
  );
  assert.equal(
    new Set(basenames).size,
    basenames.length,
    "shadcn requires unambiguous generated basenames",
  );
  const targets = new Set(
    registry.items.flatMap((item) =>
      item.files.map((file) =>
        file.target.replace("@components/", "~/components/"),
      ),
    ),
  );
  for (const item of registry.items) {
    for (const dependency of item.registryDependencies) {
      assert.ok(
        registry.items.some((entry) =>
          dependency.endsWith(`/${entry.name}.json`),
        ),
        dependency,
      );
    }
    for (const file of item.files) {
      assert.doesNotMatch(file.path, /\.(spec|test)\./);
      assert.doesNotMatch(file.content, /["']@acme\//);
      const imports = [
        ...file.content.matchAll(/(?:from\s*|import\s*\(?)["']([^"']+)["']/g),
      ];
      for (const [, specifier] of imports) {
        if (!specifier.startsWith(".") && !specifier.startsWith("@/")) continue;
        const fileTarget = file.target.replace("@components/", "~/components/");
        const target = specifier.startsWith("@/")
          ? `~/${specifier.slice(2)}`
          : `~${resolve(dirname(fileTarget.slice(1)), specifier)}`;
        assert.ok(
          [target, `${target}.ts`, `${target}.tsx`, `${target}/index.ts`].some(
            (path) => targets.has(path),
          ),
          `${file.path}: ${specifier}`,
        );
      }
    }
  }
});
