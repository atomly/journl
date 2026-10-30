// biome-ignore-all lint/style/noProcessEnv: Workflow reads these supported settings directly from the runtime environment.
import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";
import { env, parseNextDevOrigins } from "~/env";
import { prepareLocalWorkflowStorage } from "./src/workflows/local-storage";

// Keep local Workflow state outside the build directory that Next cleans.
if (
  !process.env.VERCEL_DEPLOYMENT_ID &&
  (!process.env.WORKFLOW_TARGET_WORLD ||
    process.env.WORKFLOW_TARGET_WORLD === "local")
) {
  process.env.WORKFLOW_TARGET_WORLD = "local";
  process.env.WORKFLOW_LOCAL_DATA_DIR ??= ".workflow-data";
}

const config: NextConfig = {
  /* Adding support for cross origin request in development */
  allowedDevOrigins: parseNextDevOrigins(env.AUTH_DEV_ORIGINS),
  // CI dev servers use disposable services and do not reuse compilation caches.
  experimental: { turbopackFileSystemCacheForDev: !process.env.CI },
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

// Preserve legacy local history even when switching to another World.
prepareLocalWorkflowStorage(
  process.cwd(),
  !process.env.VERCEL_DEPLOYMENT_ID &&
    process.env.WORKFLOW_TARGET_WORLD === "local"
    ? (process.env.WORKFLOW_LOCAL_DATA_DIR ?? ".workflow-data")
    : ".workflow-data",
);

export default withWorkflow(config);
