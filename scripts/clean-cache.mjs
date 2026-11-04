import { existsSync, globSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

process.chdir(fileURLToPath(new URL("../", import.meta.url)));
if (
  ["apps/web/.next/dev/lock", "apps/web/.next/lock"].some((path) =>
    existsSync(path),
  )
) {
  throw new Error(
    "Stop Next.js builds and development servers before cleaning their caches.",
  );
}
// Deliberately exclude Workflow state, pnpm dependencies, and failure reports.
for (const path of globSync([
  ".turbo",
  "apps/*/.turbo",
  "packages/*/.turbo",
  "tooling/*/.turbo",
  "apps/web/.next/dev",
  "apps/web/.next/cache",
  "apps/web/.next/diagnostics",
])) {
  rmSync(path, { force: true, recursive: true });
  process.stdout.write(`Removed ${path}\n`);
}
