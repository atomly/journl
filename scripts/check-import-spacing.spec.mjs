import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { fileURLToPath } from "node:url";

const script = fileURLToPath(
  new URL("./check-import-spacing.mjs", import.meta.url),
);

test("import gap lint and fixes preserve comments, strings, multiline imports and line endings", () => {
  const cwd = mkdtempSync(join(tmpdir(), "import-spacing-"));
  try {
    execFileSync("git", ["init", "--quiet"], { cwd });
    const cases = [
      [
        'import {\n x\n} from "x";\nconst a = 1;\n',
        'import {\n x\n} from "x";\n\nconst a = 1;\n',
      ],
      [
        'import "x"; // side effect\n/** API */\nexport const a = 1;\n',
        'import "x"; // side effect\n\n/** API */\nexport const a = 1;\n',
      ],
      [
        'import "x";\r\n\r\n\r\nconst a = 1;\r\n',
        'import "x";\r\n\r\nconst a = 1;\r\n',
      ],
      ['import "x";\n\n// attached\nconst a = "import y from y;";\n', null],
      ['import "x";\nimport "y";\n', null],
      ['const a = "import y from y;";\n', null],
    ];
    for (const [index, [input]] of cases.entries())
      writeFileSync(join(cwd, `${index}.ts`), input);
    execFileSync("git", ["add", "."], { cwd });
    const run = (args = []) =>
      spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8" });
    assert.equal(run().status, 1);
    const fixed = run(["--fix"]);
    assert.equal(fixed.status, 0, fixed.stderr);
    for (const [index, [input, expected]] of cases.entries())
      assert.equal(
        readFileSync(join(cwd, `${index}.ts`), "utf8"),
        expected ?? input,
      );
    const clean = run();
    assert.equal(clean.status, 0, clean.stderr);
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});
