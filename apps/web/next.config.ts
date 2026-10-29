import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";
import { env, parseAuthDevOrigins } from "~/env";

// pnpm's global virtual store lives outside the repository. Allow only that
// symlink target, rather than widening Turbopack's watched root to the home dir.
const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const modules = readFileSync(
  resolve(workspaceRoot, "node_modules/.modules.yaml"),
  "utf8",
);
const virtualStoreDir: string | undefined = modules.trimStart().startsWith("{")
  ? JSON.parse(modules).virtualStoreDir
  : modules
      .match(/^virtualStoreDir:\s*(.+)$/m)?.[1]
      ?.replace(/^['"]|['"]$/g, "");
const store =
  virtualStoreDir && resolve(workspaceRoot, "node_modules", virtualStoreDir);
const externalStore = store && relative(workspaceRoot, store).startsWith("..");

const config: NextConfig = {
  /* Adding support for cross origin request in development */
  allowedDevOrigins: parseAuthDevOrigins(env.AUTH_DEV_ORIGINS),
  experimental: {
    turbopackAdditionalRoots: externalStore
      ? { pnpmStore: { path: store } }
      : {},
  },
  /** Enables hot reloading for local packages without a build step */
  transpilePackages: [
    "@acme/better-editor",
    "@acme/document",
    "@acme/references",
    "@acme/auth",
    "@acme/blocknote",
    "@acme/db",
    "@acme/graph",
    "@acme/ui",
  ],
  typescript: { ignoreBuildErrors: true },
};

export default withWorkflow(config);
